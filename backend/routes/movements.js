const router = require('express').Router();
const Inventory = require('../models/Inventory');
const Movement = require('../models/Movement');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const protect = require('../middleware/auth');

// Helper: upsert inventory
const updateInventory = async (productId, locationId, delta) => {
  await Inventory.findOneAndUpdate(
    { product: productId, location: locationId },
    { $inc: { quantity: delta } },
    { upsert: true, new: true }
  );
};

// ─── STOCK IN ────────────────────────────────────────────────────────────────
router.post('/stock-in', protect('admin'), async (req, res) => {
  const { productId, quantity } = req.body;
  const locationId = req.user.location._id;
  try {
    await updateInventory(productId, locationId, quantity);
    await Movement.create({
      product: productId,
      toLocation: locationId,
      quantity,
      type: 'stock_in',
      scannedBy: req.user._id
    });
    res.json({ success: true, message: `${quantity} units added to inventory` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DISPATCH ────────────────────────────────────────────────────────────────
router.post('/dispatch', protect('admin'), async (req, res) => {
  const { productId, quantity, toLocationId } = req.body;
  const fromLocationId = req.user.location._id;
  try {
    const factoryStock = await Inventory.findOne({ product: productId, location: fromLocationId });
    if (!factoryStock || factoryStock.quantity < quantity)
      return res.status(400).json({ error: 'Not enough stock at factory' });

    // Deduct from factory immediately
    await updateInventory(productId, fromLocationId, -quantity);

    // Create a pending dispatch movement — shop will confirm it
    await Movement.create({
      product: productId,
      fromLocation: fromLocationId,
      toLocation: toLocationId,
      quantity,
      type: 'dispatch',
      status: 'pending',
      scannedBy: req.user._id
    });

    res.json({ success: true, message: `${quantity} units dispatched` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET PENDING DISPATCHES for a product at a shop ──────────────────────────
router.get('/pending/:productId', protect(['admin', 'shop_worker']), async (req, res) => {
  const locationId = req.user.location._id;
  try {
    const pending = await Movement.find({
      product: req.params.productId,
      toLocation: locationId,
      type: 'dispatch',
      status: 'pending'
    }).populate('fromLocation', 'name');

    const totalPending = pending.reduce((sum, m) => sum + m.quantity, 0);
    res.json({ pending, totalPending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RECEIVE ─────────────────────────────────────────────────────────────────
router.post('/receive', protect(['admin', 'shop_worker']), async (req, res) => {
  const { productId } = req.body;
  const locationId = req.user.location._id;
  try {
    // Find all pending dispatches for this product at this shop
    const pending = await Movement.find({
      product: productId,
      toLocation: locationId,
      type: 'dispatch',
      status: 'pending'
    });

    if (!pending.length)
      return res.status(400).json({ error: 'No pending stock to receive for this product' });

    const totalQty = pending.reduce((sum, m) => sum + m.quantity, 0);

    // Mark all as received
    await Movement.updateMany(
      { _id: { $in: pending.map(m => m._id) } },
      { status: 'received' }
    );

    // Add to shop inventory
    await updateInventory(productId, locationId, totalQty);

    await Movement.create({
      product: productId,
      toLocation: locationId,
      quantity: totalQty,
      type: 'receive',
      status: 'done',
      scannedBy: req.user._id
    });

    res.json({ success: true, quantity: totalQty, message: `${totalQty} units received into shop` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SELL ─────────────────────────────────────────────────────────────────────
router.post('/sell', protect(['admin', 'shop_worker']), async (req, res) => {
  const { productId, quantity, clientName, clientPhone, paymentMethod } = req.body;
  const locationId = req.user.location._id;
  try {
    const shopStock = await Inventory.findOne({ product: productId, location: locationId });
    if (!shopStock || shopStock.quantity < quantity)
      return res.status(400).json({ error: `Not enough stock. Available: ${shopStock?.quantity || 0}` });

    const product = await Product.findById(productId);
    await updateInventory(productId, locationId, -quantity);

    const sale = await Sale.create({
      product: productId,
      location: locationId,
      quantity,
      sellingPrice: product.sellingPrice,
      soldBy: req.user._id,
      clientName,
      clientPhone,
      paymentMethod: paymentMethod || 'cash'
    });

    await Movement.create({
      product: productId,
      fromLocation: locationId,
      quantity,
      type: 'sold',
      status: 'done',
      scannedBy: req.user._id
    });

    res.json({ success: true, sale, remainingStock: shopStock.quantity - quantity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;