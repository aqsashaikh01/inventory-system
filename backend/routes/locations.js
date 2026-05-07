const router = require('express').Router();
const Location = require('../models/Location');
const protect = require('../middleware/auth');

// GET all locations by their outlets
router.get('/', async (req, res) => {
  const locations = await Location.find();
  res.json(locations);
});

// POST create location
router.post('/', async (req, res) => {
  const { name, type, address } = req.body;
  try {
    const location = await Location.create({ name, type, address });
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update location
router.put('/:id', protect('admin'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE location
router.delete('/:id', protect('admin'), async (req, res) => {
  try {
    await Location.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;