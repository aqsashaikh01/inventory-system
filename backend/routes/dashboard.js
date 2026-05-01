const router = require('express').Router();
const Unit = require('../models/Unit');
const protect = require('../middleware/auth');

// GET /api/dashboard/daily — today's sales from units
router.get('/daily', protect('admin'), async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  try {
    const soldUnits = await Unit.find({
      status: 'sold',
      soldAt: { $gte: start, $lte: end }
    })
      .populate('product', 'name category sellingPrice sku')
      .populate('currentLocation', 'name')
      .populate('scannedBy', 'name');

    // Group by location
    const byLocation = {};
    soldUnits.forEach(u => {
      const locName = u.currentLocation?.name || 'Unknown';
      if (!byLocation[locName]) {
        byLocation[locName] = { sales: [], totalUnits: 0, totalRevenue: 0 };
      }
      byLocation[locName].sales.push(u);
      byLocation[locName].totalUnits += 1;
      byLocation[locName].totalRevenue += u.product?.sellingPrice || 0;
    });

    res.json({ date: start.toDateString(), byLocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/inventory — current stock from units
router.get('/inventory', protect('admin'), async (req, res) => {
  try {
    // Get all units that are in_factory or in_shop, grouped by product + location
    const units = await Unit.find({
      status: { $in: ['in_factory', 'in_shop'] }
    })
      .populate('product', 'name category sku sellingPrice')
      .populate('currentLocation', 'name type');

    // Group by product + location
    const grouped = {};
    units.forEach(u => {
      const key = `${u.product?._id}_${u.currentLocation?._id}`;
      if (!grouped[key]) {
        grouped[key] = {
          product: u.product,
          location: u.currentLocation,
          quantity: 0
        };
      }
      grouped[key].quantity += 1;
    });

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/movements — recent unit scan activity
router.get('/movements', protect('admin'), async (req, res) => {
  try {
    const units = await Unit.find()
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate('product', 'name sku')
      .populate('currentLocation', 'name')
      .populate('dispatchedTo', 'name')
      .populate('scannedBy', 'name role');

    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;