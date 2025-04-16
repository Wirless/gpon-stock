/**
 * User routes
 * Handles all user authentication and management routes
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, isAdmin } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Login page
router.get('/login', userController.getLogin);

// Login process
router.post('/login', userController.postLogin);

// Register page (admin only)
router.get('/register', ensureAuthenticated, isAdmin, userController.getRegister);

// Register process (admin only)
router.post('/register', ensureAuthenticated, isAdmin, userController.postRegister);

// Logout
router.get('/logout', userController.logout);

// Profile page
router.get('/profile', ensureAuthenticated, userController.getProfile);

// Update profile
router.post('/profile', ensureAuthenticated, userController.updateProfile);

// User management routes (admin only)
router.get('/manage', ensureAuthenticated, isAdmin, userController.getUsers);

// Get user by ID (admin only)
router.get('/:id', ensureAuthenticated, isAdmin, userController.getUserById);

// Update user (admin only)
router.post('/:id', ensureAuthenticated, isAdmin, userController.updateUser);

// Delete user (admin only)
router.delete('/:id', ensureAuthenticated, isAdmin, userController.deleteUser);

module.exports = router; 