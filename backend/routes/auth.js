const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Location = require('../models/Location');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const user = await User.findOne({ phone }).populate('location');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ error: 'Invalid phone or password' });

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        location: user.location
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, phone, password, role, locationId } = req.body;
  try {
    console.log('register hit - body:', req.body);

    const location = await Location.findById(locationId);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ error: 'Phone already registered' });

    const user = await User.create({ name, phone, password, role, location: locationId });

    res.status(201).json({
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, role: user.role, location }
    });
  } catch (err) {
    console.log('register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
      return res.status(401).json({ error: 'Not authorized' });

    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('location').select('-password');
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Token invalid' });
  }
});

module.exports = router;