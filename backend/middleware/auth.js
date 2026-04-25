const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = (roles = []) => async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Not authorized, no token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('location').select('-password');
    
    if (!user || !user.isActive)
      return res.status(401).json({ error: 'User not found or deactivated' });

    if (roles.length && !roles.includes(user.role))
      return res.status(403).json({ error: 'Access denied' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalid' });
  }
};

module.exports = protect;