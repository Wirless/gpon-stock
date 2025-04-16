/**
 * User Controller
 * Handles all user-related operations including auth, registration, profile management
 */
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Render login form
exports.getLogin = (req, res) => {
  res.render('users/login', {
    title: 'Login'
  });
};

// Process login form
exports.postLogin = (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/users/login',
    failureFlash: true
  })(req, res, next);
};

// Render registration form (admin only)
exports.getRegister = (req, res) => {
  res.render('users/register', {
    title: 'Register New Installator'
  });
};

// Process registration form (admin only)
exports.postRegister = async (req, res) => {
  const { name, email, password, password2, role } = req.body;
  let errors = [];

  // Check required fields
  if (!name || !email || !password || !password2) {
    errors.push({ msg: 'Please fill in all fields' });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: 'Passwords do not match' });
  }

  // Check password length
  if (password.length < 6) {
    errors.push({ msg: 'Password should be at least 6 characters' });
  }

  if (errors.length > 0) {
    return res.render('users/register', {
      title: 'Register New Installator',
      errors,
      name,
      email,
      role
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      errors.push({ msg: 'Email already registered' });
      return res.render('users/register', {
        title: 'Register New Installator',
        errors,
        name,
        email,
        role
      });
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password,
      role: role || 'installator'
    });

    await newUser.save();
    req.flash('success_msg', 'User registered successfully');
    res.redirect('/users/manage');
  } catch (err) {
    console.error('Registration error:', err);
    req.flash('error_msg', 'An error occurred during registration');
    res.redirect('/users/register');
  }
};

// Show all users (admin only)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ dateCreated: -1 });
    res.render('users/manage', {
      title: 'Manage Users',
      users
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    req.flash('error_msg', 'Failed to load users');
    res.redirect('/dashboard');
  }
};

// Get user by ID (admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users/manage');
    }
    
    res.render('users/edit', {
      title: 'Edit User',
      user
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    req.flash('error_msg', 'Failed to load user');
    res.redirect('/users/manage');
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, active } = req.body;
    
    // Find user by ID
    let user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users/manage');
    }
    
    // Update user fields
    user.name = name;
    user.email = email;
    user.role = role;
    
    await user.save();
    
    req.flash('success_msg', 'User updated successfully');
    res.redirect('/users/manage');
  } catch (err) {
    console.error('User update error:', err);
    req.flash('error_msg', 'Failed to update user');
    res.redirect('/users/manage');
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users/manage');
    }
    
    // Check if trying to delete own account
    if (user._id.toString() === req.user._id.toString()) {
      req.flash('error_msg', 'You cannot delete your own account');
      return res.redirect('/users/manage');
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    req.flash('success_msg', 'User deleted successfully');
    res.redirect('/users/manage');
  } catch (err) {
    console.error('User deletion error:', err);
    req.flash('error_msg', 'Failed to delete user');
    res.redirect('/users/manage');
  }
};

// User profile page
exports.getProfile = (req, res) => {
  res.render('users/profile', {
    title: 'My Profile',
    user: req.user
  });
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;
    
    // Find user by ID
    const user = await User.findById(userId);
    
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/users/profile');
    }
    
    // Basic profile update
    user.name = name;
    
    // Password change if requested
    if (newPassword) {
      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      
      if (!isMatch) {
        req.flash('error_msg', 'Current password is incorrect');
        return res.redirect('/users/profile');
      }
      
      // Check password match
      if (newPassword !== confirmPassword) {
        req.flash('error_msg', 'New passwords do not match');
        return res.redirect('/users/profile');
      }
      
      // Check password length
      if (newPassword.length < 6) {
        req.flash('error_msg', 'Password should be at least 6 characters');
        return res.redirect('/users/profile');
      }
      
      // Update password
      user.password = newPassword;
    }
    
    await user.save();
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/users/profile');
  } catch (err) {
    console.error('Profile update error:', err);
    req.flash('error_msg', 'Failed to update profile');
    res.redirect('/users/profile');
  }
};

// Logout user
exports.logout = (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/users/login');
  });
};

// API login - returns JWT token
exports.apiLogin = async (req, res) => {
  const { email, password } = req.body;
  
  // Validate
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }
  
  try {
    // Check for user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create JWT payload
    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '1d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          success: true,
          token: token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        });
      }
    );
  } catch (err) {
    console.error('API login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}; 