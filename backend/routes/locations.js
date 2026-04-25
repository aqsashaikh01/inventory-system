const router = require('express').Router();
const Location = require('../models/Location');
const protect = require('../middleware/auth');

// GET all locations
router.get('/', async (req, res) => {
  const locations = await Location.find();
  res.json(locations);
});

// POST create location (admin only)
router.post('/', async (req, res) => {
  const { name, type, address } = req.body;
  try {
    const location = await Location.create({ name, type, address });
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;