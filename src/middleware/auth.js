/**
 * Authentication middleware
 * Provides functions to check if users are authenticated
 * and have appropriate role permissions
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to ensure user is authenticated
exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view this resource');
  res.redirect('/users/login');
};

// Middleware to protect API routes using JWT
exports.authenticateJWT = async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by id
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware to check if user is admin
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  if (req.xhr || req.headers.accept.indexOf('json') !== -1) {
    return res.status(403).json({ message: 'Access denied. Admin rights required.' });
  }
  
  req.flash('error_msg', 'Access denied. Admin rights required.');
  res.redirect('/dashboard');
};

// Middleware to check if user is installator
exports.isInstallator = (req, res, next) => {
  if (req.user && (req.user.role === 'installator' || req.user.role === 'admin')) {
    return next();
  }
  
  if (req.xhr || req.headers.accept.indexOf('json') !== -1) {
    return res.status(403).json({ message: 'Access denied. Installator rights required.' });
  }
  
  req.flash('error_msg', 'Access denied. Installator rights required.');
  res.redirect('/dashboard');
}; 