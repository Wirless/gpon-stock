/**
 * Main routes for the application
 * Includes homepage, dashboard, and other static pages
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const indexController = require('../controllers/indexController');

// Homepage route
router.get('/', indexController.getHomePage);

// Dashboard - Protected route
router.get('/dashboard', ensureAuthenticated, indexController.getDashboard);

module.exports = router; 