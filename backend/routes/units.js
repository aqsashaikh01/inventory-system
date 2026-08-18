const router = require('express').Router();
const mongoose = require('mongoose');
const Unit = require('../models/Unit');
const Product = require('../models/Product');
const protect = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const { generateBarcodePng } = require('../utils/barcode');
process.env.FONTCONFIG_PATH = '/tmp/fonts';

// Label dimensions in PDF points (1mm = 2.8346pt) — 60×40mm roll.
// Must match the die-cut roll loaded in the printer.
const MM = 2.8346;
const LABEL_W = 60 * MM;
const LABEL_H = 40 * MM;

// Label canvas — 720×480px over 60×40mm is 305dpi, so 12px = 1mm
const LABEL_PX_W = 720;
const LABEL_PX_H = 480;

// Barcode footprint on that canvas. 528px = 44mm holds the Code128 module at
// ~0.2mm, about the narrowest a 300dpi thermal print scans reliably — so the
// height is what shrinks, which costs nothing: stretching bars is lossless.
const BARCODE_W = 528;
const BARCODE_H = 160;

// Text is deliberately small: the barcode does the work, the words only have
// to be legible up close. Sizes are canvas px, i.e. 12px = 1mm.
const NAME_SLOT_W = 600;
const NAME_SLOT_H = 64;
const NAME_FONT_PX = 56;   // drawn at 2× and downscaled → ~2.3mm on the label
const MRP_FONT_PX = 26;    // ~2.2mm

// Vertical layout — leaves an even ~7.5mm of blank label above the name and
// below the price, which also absorbs any feed drift on the die-cut roll.
const NAME_Y = 90;
const BARCODE_Y = 180;
const MRP_Y = 364;

const escapeXml = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// SVG is rasterised at 300dpi rather than its nominal size, so a user unit in
// the markup below lands on DENSITY/72 pixels.
const DENSITY = 300;
const PX_PER_UNIT = DENSITY / 72;

const buildTextSvg = (lines, fontSize, widthPx, heightPx) => {
  // One line sits on the slot's midline; two share it above and below.
  const baselines = lines.length === 1
    ? [heightPx * 0.65]
    : [heightPx * 0.38, heightPx * 0.80];

  const texts = lines.map((line, i) => `<text x="${widthPx / 2}" y="${baselines[i]}"
      font-family="Noto Sans Devanagari, sans-serif" font-size="${fontSize}" font-weight="700"
      fill="#111110" text-anchor="middle">${escapeXml(line)}</text>`).join('');

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">
    <rect width="${widthPx}" height="${heightPx}" fill="white"/>
    ${texts}
  </svg>`);
};

// How wide the glyphs actually come out, in SVG user units. There's no text
// metrics API on this path, so it renders once on an over-wide canvas — wide
// enough that nothing can clip — and trims to the ink.
const measureTextWidth = async (lines, fontSize, heightPx) => {
  const probeWidth = Math.max(...lines.map(l => l.length)) * fontSize + fontSize * 4;
  const svg = buildTextSvg(lines, fontSize, probeWidth, heightPx);
  try {
    const { info } = await sharp(svg, { density: DENSITY })
      .png()
      .trim({ background: '#ffffff', threshold: 10 })
      .toBuffer({ resolveWithObject: true });
    return info.width / PX_PER_UNIT;
  } catch {
    return 0; // blank render (empty name) — nothing to fit
  }
};

// Renders the product name via sharp SVG → PNG buffer → loadable by canvas.
// Keeps the name on one line whenever it fits the slot, wraps to two only when
// it genuinely runs out of width, and shrinks the type if even that overflows.
const renderMarathiText = async (text, widthPx = 540, heightPx = 120, fontSize = 52) => {
  const allowed = widthPx * 0.98;
  const words = text.trim().split(/\s+/).filter(Boolean);

  let lines = [text];
  let size = fontSize;

  if (words.length > 1 && await measureTextWidth([text], fontSize, heightPx) > allowed) {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    // Two lines have to share the same band, and Devanagari matras sit above
    // and below the baseline — shrink the font or they collide.
    size = Math.round(fontSize * 0.78);
  }

  // A long unsplittable name can still overrun; scale it down to fit rather
  // than let the slot clip it.
  const width = await measureTextWidth(lines, size, heightPx);
  if (width > allowed) size = Math.max(12, Math.floor(size * allowed / width));

  return await sharp(buildTextSvg(lines, size, widthPx, heightPx), { density: DENSITY })
    .png()
    .toBuffer();
};

// POST /api/units/generate
router.post('/generate', protect('admin'), async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const marathiName = product.marathiName || product.name;
    // Number from the highest code ever issued, not the live count — units can
    // be removed from stock, and reusing a number would collide on unitCode.
    const existingCodes = await Unit.find({ product: productId }, { unitCode: 1 }).lean();
    const existing = existingCodes.reduce((max, u) => {
      const m = u.unitCode?.match(/-UNIT-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);

    // Pre-render Marathi name once at 2× the slot it's drawn into, so the
    // downscale stays sharp and the aspect ratio isn't squashed
    const marathiPngBuffer = await renderMarathiText(marathiName, NAME_SLOT_W * 2, NAME_SLOT_H * 2, NAME_FONT_PX);
    const textImage = await loadImage(marathiPngBuffer);

    // Set up PDF — each page = one label
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    const pdfReady = new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    for (let i = 0; i < quantity; i++) {
      const num = String(existing + i + 1).padStart(3, '0');
      const unitCode = `${product.sku}-UNIT-${num}`;
      const scanUrl = `${process.env.APP_URL}/unit/${unitCode}`;

      const canvas = createCanvas(LABEL_PX_W, LABEL_PX_H);
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, LABEL_PX_W, LABEL_PX_H);

      // --- Marathi name ---
      ctx.drawImage(textImage, (LABEL_PX_W - NAME_SLOT_W) / 2, NAME_Y, NAME_SLOT_W, NAME_SLOT_H);

      // --- Barcode (Code128, encodes the bare unit code) ---
      const barcodePng = await generateBarcodePng(unitCode);
      const barcodeImage = await loadImage(barcodePng);
      ctx.drawImage(barcodeImage, (LABEL_PX_W - BARCODE_W) / 2, BARCODE_Y, BARCODE_W, BARCODE_H);

      // --- MRP ---
      ctx.fillStyle = '#1a4a2e';
      ctx.font = `bold ${MRP_FONT_PX}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`Maximum Retail Price - ${Number(product.sellingPrice).toLocaleString('en-IN')}`, LABEL_PX_W / 2, MRP_Y);

      const pngBuffer = canvas.toBuffer('image/png');

      doc.addPage({ size: [LABEL_W, LABEL_H], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      doc.image(pngBuffer, 0, 0, { width: LABEL_W, height: LABEL_H });

      await Unit.create({ unitCode, product: productId, qrCodeUrl: scanUrl, codeType: 'barcode' });
    }

    doc.end();
    const pdfBuffer = await pdfReady;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="stickers-${product.sku}-${quantity}units.pdf"`,
    });
    res.send(pdfBuffer);

  } catch (err) {
    console.log('Generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/units/scan/:unitCode
router.get('/scan/:unitCode', protect(), async (req, res) => {
  try {
    const unit = await Unit.findOne({ unitCode: req.params.unitCode })
      .populate('product')
      .populate('currentLocation')
      .populate('dispatchedTo');

    if (!unit) return res.status(404).json({ error: 'Unit not found. Invalid code.' });

    const user = req.user;
    const locationType = user.location?.type;
    const role = user.role;
    const userLocationId = user.location?._id?.toString();

    let availableAction = null;

    if (role === 'admin' || locationType === 'factory') {
      if (unit.status === 'generated') availableAction = 'stock_in';
      else if (unit.status === 'in_factory') availableAction = 'dispatch';
      else availableAction = null;
    }

    if (locationType === 'shop') {
      if (unit.status === 'dispatched' &&
          unit.dispatchedTo?._id?.toString() === userLocationId) {
        availableAction = 'receive';
      } else if (unit.status === 'in_shop' &&
                 unit.currentLocation?._id?.toString() === userLocationId) {
        availableAction = 'sell';
      } else {
        availableAction = null;
      }
    }

    res.json({ unit, availableAction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/units/stock-in/:unitCode
router.post('/stock-in/:unitCode', protect('admin'), async (req, res) => {
  try {
    const unit = await Unit.findOne({ unitCode: req.params.unitCode }).populate('product');
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    if (unit.status !== 'generated')
      return res.status(400).json({ error: `Already scanned. Status: ${unit.status}` });

    unit.status = 'in_factory';
    unit.currentLocation = req.user.location._id;
    unit.scannedBy = req.user._id;
    await unit.save();

    res.json({ success: true, message: `${unit.unitCode} added to factory inventory`, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/units/dispatch/:unitCode
router.post('/dispatch/:unitCode', protect('admin'), async (req, res) => {
  const { toLocationId } = req.body;
  try {
    const unit = await Unit.findOne({ unitCode: req.params.unitCode });
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    if (unit.status !== 'in_factory')
      return res.status(400).json({ error: `Cannot dispatch. Status: ${unit.status}` });

    unit.status = 'dispatched';
    unit.dispatchedTo = toLocationId;
    unit.scannedBy = req.user._id;
    await unit.save();

    res.json({ success: true, message: `${unit.unitCode} dispatched`, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/units/receive/:unitCode
router.post('/receive/:unitCode', protect(['admin', 'shop_worker']), async (req, res) => {
  try {
    const unit = await Unit.findOne({ unitCode: req.params.unitCode });
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    if (unit.status !== 'dispatched')
      return res.status(400).json({ error: `Cannot receive. Status: ${unit.status}` });

    unit.status = 'in_shop';
    unit.currentLocation = req.user.location._id;
    unit.scannedBy = req.user._id;
    await unit.save();

    res.json({ success: true, message: `${unit.unitCode} received into shop`, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/units/sell/:unitCode
router.post('/sell/:unitCode', protect(['admin', 'shop_worker']), async (req, res) => {
  const { clientName, clientPhone, paymentMethod } = req.body;
  try {
    const unit = await Unit.findOne({ unitCode: req.params.unitCode }).populate('product');
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    if (unit.status === 'sold') return res.status(400).json({ error: 'Already sold' });
    if (unit.status !== 'in_shop') return res.status(400).json({ error: `Cannot sell. Status: ${unit.status}` });

    unit.status = 'sold';
    unit.soldAt = new Date();
    unit.scannedBy = req.user._id;
    unit.clientName = clientName || '';
    unit.clientPhone = clientPhone || '';
    unit.paymentMethod = paymentMethod || 'cash';
    await unit.save();

    const invoice = {
      invoiceNumber: `INV-${unit.unitCode}`,
      unitCode: unit.unitCode,
      productName: unit.product.name,
      sellingPrice: unit.product.sellingPrice,
      clientName: unit.clientName,
      clientPhone: unit.clientPhone,
      paymentMethod: unit.paymentMethod,
      soldAt: unit.soldAt,
      soldBy: req.user.name,
      location: req.user.location?.name,
    };

    res.json({ success: true, invoice, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/units/product/:productId
router.get('/product/:productId', protect('admin'), async (req, res) => {
  try {
    const units = await Unit.find({ product: req.params.productId })
      .populate('currentLocation', 'name')
      .populate('dispatchedTo', 'name')
      .sort({ createdAt: -1 });
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/units/remove-stock
// Removes `quantity` units of a product from one location's stock — used when
// stock is damaged/lost and has to come off the count without wiping the product.
router.post('/remove-stock', protect('admin'), async (req, res) => {
  const { productId, locationId, quantity } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(locationId))
      return res.status(400).json({ error: 'Invalid product or location' });

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1)
      return res.status(400).json({ error: 'Quantity must be a whole number of 1 or more' });

    const inStock = { product: productId, currentLocation: locationId, status: { $in: ['in_factory', 'in_shop'] } };
    const available = await Unit.countDocuments(inStock);

    if (available === 0)
      return res.status(400).json({ error: 'No stock of this product at this location' });
    if (qty > available)
      return res.status(400).json({ error: `Only ${available} unit${available !== 1 ? 's' : ''} in stock at this location` });

    // Remove the newest units first so the printed sticker numbers left in
    // circulation stay contiguous from the oldest.
    const doomed = await Unit.find(inStock).sort({ createdAt: -1 }).limit(qty).select('_id').lean();
    await Unit.deleteMany({ _id: { $in: doomed.map(u => u._id) } });

    res.json({ success: true, removed: doomed.length, remaining: available - doomed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;