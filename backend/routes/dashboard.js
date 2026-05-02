const router = require('express').Router();
const Unit = require('../models/Unit');
const protect = require('../middleware/auth');

// GET /api/dashboard/daily — today's sales from units
router.get('/daily', protect('admin'), async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  try {
    const soldUnits = await Unit.find({
      status: 'sold',
      soldAt: { $gte: start, $lte: end }
    })
      .populate('product', 'name category sellingPrice sku')
      .populate('currentLocation', 'name')
      .populate('scannedBy', 'name');

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

router.get('/stock-by-location', protect('admin'), async (req, res) => {
  try {
    const units = await require('../models/Unit').find({
      status: { $in: ['in_factory', 'dispatched', 'in_shop', 'sold'] }
    })
      .populate('product', 'name sku category')
      .populate('currentLocation', 'name type')
      .populate('dispatchedTo', 'name type');

    const locations = await require('../models/Location').find();

    // Build stock map: { locationName: { productName: count } }
    const stockMap = {};

    locations.forEach(l => {
      stockMap[l.name] = { _id: l._id, type: l.type, products: {} };
    });

    units.forEach(unit => {
      const productName = unit.product?.name;
      if (!productName) return;

      if (unit.status === 'in_factory' && unit.currentLocation) {
        const locName = unit.currentLocation.name;
        if (!stockMap[locName]) return;
        if (!stockMap[locName].products[productName]) stockMap[locName].products[productName] = 0;
        stockMap[locName].products[productName]++;
      }

      if (unit.status === 'in_shop' && unit.currentLocation) {
        const locName = unit.currentLocation.name;
        if (!stockMap[locName]) return;
        if (!stockMap[locName].products[productName]) stockMap[locName].products[productName] = 0;
        stockMap[locName].products[productName]++;
      }

      if (unit.status === 'dispatched' && unit.dispatchedTo) {
        const locName = unit.dispatchedTo.name + ' (In Transit)';
        if (!stockMap[locName]) stockMap[locName] = { products: {} };
        if (!stockMap[locName].products[productName]) stockMap[locName].products[productName] = 0;
        stockMap[locName].products[productName]++;
      }
    });

    res.json(stockMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;