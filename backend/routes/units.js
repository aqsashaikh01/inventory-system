const router = require('express').Router();
const Unit = require('../models/Unit');
const Product = require('../models/Product');
const protect = require('../middleware/auth');
const QRCode = require('qrcode');
const JSZip = require('jszip');

// POST /api/units/generate
// Admin selects product + quantity → generates N unique unit QRs
router.post('/generate', protect('admin'), async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const existing = await Unit.countDocuments({ product: productId });

    const zip = new JSZip();
    const folder = zip.folder(`QR-${product.sku}`);

    const { createCanvas, loadImage } = require('canvas');

    for (let i = 0; i < quantity; i++) {
      const num = String(existing + i + 1).padStart(3, '0');
      const unitCode = `${product.sku}-UNIT-${num}`;
      const scanUrl = `${process.env.APP_URL}/unit/${unitCode}`;

      // Generate QR as data URL
      const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 300, margin: 2 });

      // Create canvas — QR + label below
      const canvasWidth = 300;
      const canvasHeight = 360;
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw QR image
      const qrImage = await loadImage(qrDataUrl);
      ctx.drawImage(qrImage, 0, 0, 300, 300);

      // Divider line
      ctx.strokeStyle = '#e8e8e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 308);
      ctx.lineTo(284, 308);
      ctx.stroke();

      // Price
      ctx.fillStyle = '#1a4a2e';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`MRP. ${Number(product.sellingPrice).toLocaleString('en-IN')}`, 150, 340);

      // Convert canvas to PNG buffer
      const buffer = canvas.toBuffer('image/png');
      folder.file(`${unitCode}.png`, buffer);

      // Save unit to DB
      await Unit.create({
        unitCode,
        product: productId,
        qrCodeUrl: scanUrl
      });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="QR-${product.sku}-${quantity}units.zip"`
    });
    res.send(zipBuffer);

  } catch (err) {
    console.log('Generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/units/scan/:unitCode
// Called when any worker scans a unit QR
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

    // Add this debug log temporarily
    console.log('Unit dispatchedTo:', unit.dispatchedTo?._id?.toString());
    console.log('User location:', userLocationId);
    console.log('Unit status:', unit.status);

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
// Factory scans → auto added to factory inventory
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
// Admin dispatches unit to a shop
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
// Shop worker scans dispatched unit → added to shop inventory
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
// Shop worker confirms sell
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

    // Build invoice data to return
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
      location: req.user.location?.name
    };

    res.json({ success: true, invoice, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/units/product/:productId
// List all units for a product
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