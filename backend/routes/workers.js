const router = require('express').Router();
const User = require('../models/User');
const Location = require('../models/Location');
const protect = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET all workers
router.get('/', protect('admin'), async (req, res) => {
  try {
    const workers = await User.find({ role: { $ne: 'admin' } })
      .populate('location', 'name type')
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create worker
router.post('/', protect('admin'), async (req, res) => {
  const { name, phone, password, role, locationId } = req.body;
  try {
    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ error: 'Phone already registered' });

    const location = await Location.findById(locationId);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const user = await User.create({ name, phone, password, role, location: locationId });
    const populated = await User.findById(user._id).populate('location', 'name type').select('-password');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update worker (reassign location, change name)
router.put('/:id', protect('admin'), async (req, res) => {
  const { name, locationId, isActive } = req.body;
  try {
    const update = { name, location: locationId, isActive };
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('location', 'name type').select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE worker
router.delete('/:id', protect('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;