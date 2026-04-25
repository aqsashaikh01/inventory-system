const router = require('express').Router();
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Movement = require('../models/Movement');
const protect = require('../middleware/auth');

// GET /api/dashboard/daily  — today's sales per outlet
router.get('/daily', protect('admin'), async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  try {
    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } })
      .populate('product', 'name category')
      .populate('location', 'name')
      .populate('soldBy', 'name');

    // Group by location
    const byLocation = {};
    sales.forEach(s => {
      const locName = s.location.name;
      if (!byLocation[locName]) byLocation[locName] = { sales: [], totalUnits: 0, totalRevenue: 0 };
      byLocation[locName].sales.push(s);
      byLocation[locName].totalUnits += s.quantity;
      byLocation[locName].totalRevenue += s.quantity * s.sellingPrice;
    });

    res.json({ date: start.toDateString(), byLocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/inventory  — current stock at all locations
router.get('/inventory', protect('admin'), async (req, res) => {
  try {
    const inventory = await Inventory.find({ quantity: { $gt: 0 } })
      .populate('product', 'name category sku')
      .populate('location', 'name type');
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/movements  — recent scan activity
router.get('/movements', protect('admin'), async (req, res) => {
  try {
    const movements = await Movement.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('product', 'name sku')
      .populate('fromLocation', 'name')
      .populate('toLocation', 'name')
      .populate('scannedBy', 'name role');
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;