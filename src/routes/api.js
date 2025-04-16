/**
 * API Routes
 * Provides RESTful API endpoints for mobile app or other service integrations
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const depositController = require('../controllers/depositController');
const { authenticateJWT, isAdmin, isInstallator } = require('../middleware/auth');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const upload = require('../utils/fileUpload');
const path = require('path');
const fs = require('fs');
const barcodeScanner = require('../utils/barcodeScanner');
const imageStorage = require('../utils/imageStorage');

// API authentication
router.post('/auth/login', userController.apiLogin);

// API - Get user profile
router.get('/users/profile', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    console.error('API profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API - Get all deposits (filtered by user role)
router.get('/deposits', authenticateJWT, async (req, res) => {
  try {
    let query = {};
    
    // If not admin, only return user's deposits
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }
    
    const deposits = await Deposit.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, deposits });
  } catch (err) {
    console.error('API get deposits error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API - Get deposit by ID
router.get('/deposits/:id', authenticateJWT, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    res.json({ success: true, deposit });
  } catch (err) {
    console.error('API get deposit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API - Create new deposit
router.post('/deposits', authenticateJWT, isInstallator, async (req, res) => {
  try {
    const newDeposit = new Deposit({
      createdBy: req.user._id,
      deviceInfo: {
        model: req.body.model || '',
        partNumber: req.body.partNumber || '',
        manufactureDate: req.body.manufactureDate || ''
      },
      serialNumbers: {
        productionSN: req.body.productionSN || '',
        gponSN: req.body.gponSN || '',
        gponSNHex: req.body.gponSNHex || '',
        wanMAC: req.body.wanMAC || '',
        voipMAC: req.body.voipMAC || ''
      },
      notes: req.body.notes || '',
      images: []
    });
    
    await newDeposit.save();
    
    res.status(201).json({ success: true, deposit: newDeposit });
  } catch (err) {
    console.error('API create deposit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API - Update deposit
router.put('/deposits/:id', authenticateJWT, isInstallator, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // Update deposit fields
    if (req.body.deviceInfo) {
      deposit.deviceInfo = {
        model: req.body.deviceInfo.model || deposit.deviceInfo.model,
        partNumber: req.body.deviceInfo.partNumber || deposit.deviceInfo.partNumber,
        manufactureDate: req.body.deviceInfo.manufactureDate || deposit.deviceInfo.manufactureDate
      };
    }
    
    if (req.body.serialNumbers) {
      deposit.serialNumbers = {
        productionSN: req.body.serialNumbers.productionSN || deposit.serialNumbers.productionSN,
        gponSN: req.body.serialNumbers.gponSN || deposit.serialNumbers.gponSN,
        gponSNHex: req.body.serialNumbers.gponSNHex || deposit.serialNumbers.gponSNHex,
        wanMAC: req.body.serialNumbers.wanMAC || deposit.serialNumbers.wanMAC,
        voipMAC: req.body.serialNumbers.voipMAC || deposit.serialNumbers.voipMAC
      };
    }
    
    if (req.body.notes !== undefined) {
      deposit.notes = req.body.notes;
    }
    
    // If admin, allow status update
    if (req.user.role === 'admin' && req.body.status) {
      deposit.status = req.body.status;
    }
    
    await deposit.save();
    
    res.json({ success: true, deposit });
  } catch (err) {
    console.error('API update deposit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API - Delete deposit (admin only)
router.delete('/deposits/:id', authenticateJWT, isAdmin, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }
    
    await Deposit.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Deposit deleted successfully' });
  } catch (err) {
    console.error('API delete deposit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API - Scan image
router.get('/deposits/:depositId/images/:imageId/scan', authenticateJWT, depositController.scanImage);

// API - Direct image scan for form filling
router.post('/direct-scan', async (req, res) => {
  try {
    console.log('Received direct scan request');
    
    // Process the base64 image
    const { imageData } = req.body;
    
    if (!imageData || !imageData.startsWith('data:image')) {
      console.log('Invalid image data format received');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image data' 
      });
    }
    
    console.log(`Image data received, length: ${imageData.length} characters`);
    
    // Create a temporary file to store the image
    const tempDir = path.join(__dirname, '../../temp');
    console.log(`Temp directory path: ${tempDir}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      console.log('Creating temp directory');
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a unique filename for the temp image
    const tempFileName = `temp_${Date.now()}_${Math.round(Math.random() * 1E9)}.jpg`;
    const tempFilePath = path.join(tempDir, tempFileName);
    console.log(`Temp file path: ${tempFilePath}`);
    
    // Save the image for processing
    const savedImage = imageStorage.saveBase64Image(imageData, 'gpon');
    console.log(`Image saved to ${savedImage.filePath}`);
    
    try {
      // Use the barcode scanner to extract text
      console.log('Starting image processing...');
      const scanResult = await barcodeScanner.scanImage(savedImage.filePath);
      console.log('Scan completed - result:', JSON.stringify(scanResult));
      
      // Check if there's an error in the scan result
      if (scanResult.error) {
        console.error('Barcode scanning error:', scanResult.error);
        return res.status(500).json({
          success: false,
          message: 'Error in barcode scanning',
          error: scanResult.error
        });
      }
      
      // Parse device information from the scan result
      console.log('Parsing device information');
      const deviceInfo = barcodeScanner.parseDeviceInfo(scanResult);
      console.log('Device information parsed:', JSON.stringify(deviceInfo));
      
      // Send successful response with image URL and scan details
      return res.json({
        success: true,
        barcodes: scanResult.barcodes || [],
        textLines: scanResult.textLines || [],
        deviceInfo,
        imageUrl: savedImage.publicUrl
      });
    } catch (innerErr) {
      console.error('Processing error:', innerErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Error in image processing', 
        error: innerErr.message 
      });
    }
  } catch (err) {
    console.error('Direct scan error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Error processing image', 
      error: err.message 
    });
  }
});

module.exports = router; 