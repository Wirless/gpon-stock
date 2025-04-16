/**
 * Deposit routes
 * Handles all deposit management routes
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, isAdmin, isInstallator } = require('../middleware/auth');
const depositController = require('../controllers/depositController');
const upload = require('../utils/fileUpload');

// Get all deposits
router.get('/', ensureAuthenticated, depositController.getDeposits);

// Render create deposit form
router.get('/create', ensureAuthenticated, isInstallator, depositController.getCreateDeposit);

// Process create deposit form
router.post('/create', ensureAuthenticated, isInstallator, depositController.postCreateDeposit);

// Render upload images form
router.get('/:id/upload', ensureAuthenticated, isInstallator, depositController.getUploadImages);

// Process image uploads
router.post('/:id/upload', ensureAuthenticated, isInstallator, depositController.uploadImages);

// View deposit details
router.get('/:id', ensureAuthenticated, depositController.getDepositDetails);

// Render edit deposit form
router.get('/:id/edit', ensureAuthenticated, isInstallator, depositController.getEditDeposit);

// Process edit deposit form
router.post('/:id/edit', ensureAuthenticated, isInstallator, depositController.updateDeposit);

// Delete deposit
router.delete('/:id', ensureAuthenticated, isAdmin, depositController.deleteDeposit);

// Scan image for barcodes and text
router.get('/:depositId/images/:imageId/scan', ensureAuthenticated, isInstallator, depositController.scanImage);

module.exports = router; 