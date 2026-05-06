const router = require('express').Router();
const Unit = require('../models/Unit');
const Product = require('../models/Product');
const protect = require('../middleware/auth');
const QRCode = require('qrcode');
const JSZip = require('jszip');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
process.env.FONTCONFIG_PATH = '/tmp/fonts';

// Renders Marathi text via sharp SVG → PNG buffer → loadable by canvas
const renderMarathiText = async (text, widthPx = 270, heightPx = 30) => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">
    <rect width="${widthPx}" height="${heightPx}" fill="white"/>
    <text
      x="${widthPx / 2}"
      y="${heightPx * 0.78}"
      font-family="Noto Sans Devanagari, sans-serif"
      font-size="15"
      font-weight="600"
      fill="#111110"
      text-anchor="middle">${escaped}</text>
  </svg>`);

  return await sharp(svg, { density: 150 }).png().toBuffer();
};

// POST /api/units/generate
router.post('/generate', protect('admin'), async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const marathiName = product.marathiName || product.name;
    const existing = await Unit.countDocuments({ product: productId });
    const zip = new JSZip();
    const folder = zip.folder(`QR-${product.sku}`);

    // Load logo once
    const logoPath = path.join(__dirname, '../assets/logo.png');
    let logoImage = null;
    if (fs.existsSync(logoPath)) logoImage = await loadImage(logoPath);

    // Pre-render Marathi name as PNG buffer via sharp (same for all units)
    const marathiPngBuffer = await renderMarathiText(marathiName, 270, 30);
    const textImage = await loadImage(marathiPngBuffer);

    for (let i = 0; i < quantity; i++) {
      const num = String(existing + i + 1).padStart(3, '0');
      const unitCode = `${product.sku}-UNIT-${num}`;
      const scanUrl = `${process.env.APP_URL}/unit/${unitCode}`;

      const canvasWidth = 300;
      const canvasHeight = 460;
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      let yOffset = 12;

      // --- LOGO ---
      if (logoImage) {
        const logoH = 48;
        const logoW = (logoImage.width / logoImage.height) * logoH;
        ctx.drawImage(logoImage, (canvasWidth - logoW) / 2, yOffset, logoW, logoH);
        yOffset += logoH + 8;
      }

      // --- Divider ---
      ctx.strokeStyle = '#e8e8e0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(16, yOffset);
      ctx.lineTo(284, yOffset);
      ctx.stroke();
      yOffset += 10;

      // --- Marathi name (rendered via sharp, drawn as image) ---
      ctx.drawImage(textImage, (canvasWidth - 270) / 2, yOffset, 270, 30);
      yOffset += 30 + 6;

      // --- QR Code ---
      const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 240, margin: 1 });
      const qrImage = await loadImage(qrDataUrl);
      ctx.drawImage(qrImage, (canvasWidth - 240) / 2, yOffset, 240, 240);
      yOffset += 240 + 8;

      // --- Divider ---
      ctx.strokeStyle = '#e8e8e0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(16, yOffset);
      ctx.lineTo(284, yOffset);
      ctx.stroke();
      yOffset += 12;

      // --- MRP ---
      ctx.fillStyle = '#9A9A96';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Maximum Retail Price', 150, yOffset);
      yOffset += 18;

      ctx.fillStyle = '#1a4a2e';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`₹${Number(product.sellingPrice).toLocaleString('en-IN')}`, 150, yOffset);

      const buffer = canvas.toBuffer('image/png');
      folder.file(`${unitCode}.png`, buffer);

      await Unit.create({ unitCode, product: productId, qrCodeUrl: scanUrl });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="QR-${product.sku}-${quantity}units.zip"`,
    });
    res.send(zipBuffer);

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

    if (!unit) return res.status(404).json({ error: 'Unit not found. Invalid QR.' });

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

module.exports = router;