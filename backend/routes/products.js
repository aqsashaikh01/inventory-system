const router = require('express').Router();
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const protect = require('../middleware/auth');
const { generateQRDataURL } = require('../utils/qr');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup upload folder
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Serve uploaded images statically — add this in index.js too
// app.use('/uploads', express.static('uploads'));

// GET all products
router.get('/', protect(), async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product by SKU
router.get('/sku/:sku', protect(), async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const inventory = await Inventory.findOne({
      product: product._id,
      location: req.user.location._id
    });
    res.json({ ...product.toObject(), stockAtMyLocation: inventory ? inventory.quantity : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product by ID
router.get('/id/:id', protect(), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET QR by SKU
router.get('/qr/:sku', protect('admin'), async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { dataUrl } = await generateQRDataURL(req.params.sku, process.env.APP_URL);
    res.json({ qrDataUrl: dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product with optional photo
router.post('/', protect('admin'), upload.single('photo'), async (req, res) => {
  const { name, category, sellingPrice, description } = req.body;
  try {
    const count = await Product.countDocuments();
    const sku = `PROD-${String(count + 1).padStart(3, '0')}`;
    const { scanUrl, dataUrl } = await generateQRDataURL(sku, process.env.APP_URL);

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const product = await Product.create({
      name, category, sellingPrice, description,
      sku, qrCodeUrl: scanUrl, photo: photoUrl,
      createdBy: req.user._id
    });

    res.status(201).json({ product, qrDataUrl: dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update product
router.put('/:id', protect('admin'), upload.single('photo'), async (req, res) => {
  try {
    const { name, category, sellingPrice, description } = req.body;
    const update = { name, category, sellingPrice, description };
    if (req.file) update.photo = `/uploads/${req.file.filename}`;

    console.log('Update body:', req.body);
    console.log('File received:', req.file);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json(product);
  } catch (err) {
    console.log('Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE product
router.delete('/:id', protect('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;