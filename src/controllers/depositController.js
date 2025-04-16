/**
 * Deposit Controller
 * Handles all operations related to device deposits
 * Including creation, listing, details, updating and barcode scanning
 */
const Deposit = require('../models/Deposit');
const upload = require('../utils/fileUpload');
const barcodeScanner = require('../utils/barcodeScanner');
const fs = require('fs');
const path = require('path');

// Render deposits list page
exports.getDeposits = async (req, res) => {
  try {
    let query = {};
    
    // If user is not admin, only show their deposits
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }
    
    // Get all deposits with populated user info
    const deposits = await Deposit.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.render('deposits/index', {
      title: 'All Deposits',
      deposits
    });
  } catch (err) {
    console.error('Error fetching deposits:', err);
    req.flash('error_msg', 'Error loading deposits');
    res.redirect('/dashboard');
  }
};

// Render create deposit form
exports.getCreateDeposit = (req, res) => {
  res.render('deposits/create', {
    title: 'Create New Deposit'
  });
};

// Process create deposit form
exports.postCreateDeposit = async (req, res) => {
  try {
    // Create the deposit first to get an ID
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
    
    // Save the deposit to get an ID
    await newDeposit.save();
    
    req.flash('success_msg', 'Deposit created successfully! Please add images next.');
    res.redirect(`/deposits/${newDeposit._id}/upload`);
  } catch (err) {
    console.error('Deposit creation error:', err);
    req.flash('error_msg', 'Error creating deposit');
    res.redirect('/deposits/create');
  }
};

// Render upload images form
exports.getUploadImages = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      req.flash('error_msg', 'Deposit not found');
      return res.redirect('/deposits');
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Not authorized');
      return res.redirect('/deposits');
    }
    
    res.render('deposits/upload', {
      title: 'Upload Images',
      deposit
    });
  } catch (err) {
    console.error('Error loading deposit for upload:', err);
    req.flash('error_msg', 'Error loading deposit');
    res.redirect('/deposits');
  }
};

// Handle image uploads with multer
exports.uploadImages = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      req.flash('error_msg', 'Deposit not found');
      return res.redirect('/deposits');
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Not authorized');
      return res.redirect('/deposits');
    }
    
    // Get the upload middleware handler
    const uploadMiddleware = upload.array('images', 10); // max 10 images
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        req.flash('error_msg', `Upload error: ${err.message}`);
        return res.redirect(`/deposits/${deposit._id}/upload`);
      }
      
      if (!req.files || req.files.length === 0) {
        req.flash('error_msg', 'No files uploaded');
        return res.redirect(`/deposits/${deposit._id}/upload`);
      }
      
      // Add uploaded files to deposit
      const imagesToAdd = req.files.map(file => ({
        path: file.path.replace('public', ''), // store relative path for web access
        description: req.body.description || '',
        uploadedAt: Date.now()
      }));
      
      deposit.images.push(...imagesToAdd);
      await deposit.save();
      
      req.flash('success_msg', 'Images uploaded successfully');
      res.redirect(`/deposits/${deposit._id}`);
    });
  } catch (err) {
    console.error('Error in upload handler:', err);
    req.flash('error_msg', 'Error processing upload');
    res.redirect('/deposits');
  }
};

// View deposit details
exports.getDepositDetails = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!deposit) {
      req.flash('error_msg', 'Deposit not found');
      return res.redirect('/deposits');
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy._id.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Not authorized');
      return res.redirect('/deposits');
    }
    
    res.render('deposits/details', {
      title: 'Deposit Details',
      deposit
    });
  } catch (err) {
    console.error('Error fetching deposit details:', err);
    req.flash('error_msg', 'Error loading deposit details');
    res.redirect('/deposits');
  }
};

// Render edit deposit form
exports.getEditDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      req.flash('error_msg', 'Deposit not found');
      return res.redirect('/deposits');
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Not authorized');
      return res.redirect('/deposits');
    }
    
    res.render('deposits/edit', {
      title: 'Edit Deposit',
      deposit
    });
  } catch (err) {
    console.error('Error fetching deposit for edit:', err);
    req.flash('error_msg', 'Error loading deposit');
    res.redirect('/deposits');
  }
};

// Process edit deposit form
exports.updateDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      req.flash('error_msg', 'Deposit not found');
      return res.redirect('/deposits');
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Not authorized');
      return res.redirect('/deposits');
    }
    
    // Update deposit fields
    deposit.deviceInfo = {
      model: req.body.model || '',
      partNumber: req.body.partNumber || '',
      manufactureDate: req.body.manufactureDate || ''
    };
    
    deposit.serialNumbers = {
      productionSN: req.body.productionSN || '',
      gponSN: req.body.gponSN || '',
      gponSNHex: req.body.gponSNHex || '',
      wanMAC: req.body.wanMAC || '',
      voipMAC: req.body.voipMAC || ''
    };
    
    deposit.notes = req.body.notes || '';
    
    // If admin, allow status update
    if (req.user.role === 'admin') {
      deposit.status = req.body.status;
    }
    
    await deposit.save();
    
    req.flash('success_msg', 'Deposit updated successfully');
    res.redirect(`/deposits/${deposit._id}`);
  } catch (err) {
    console.error('Error updating deposit:', err);
    req.flash('error_msg', 'Error updating deposit');
    res.redirect(`/deposits/${req.params.id}/edit`);
  }
};

// Delete deposit
exports.deleteDeposit = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    
    if (!deposit) {
      req.flash('error_msg', 'Deposit not found');
      return res.redirect('/deposits');
    }
    
    // Only admin can delete deposits
    if (req.user.role !== 'admin') {
      req.flash('error_msg', 'Not authorized');
      return res.redirect('/deposits');
    }
    
    // Delete the associated images
    for (const image of deposit.images) {
      const imagePath = path.join(__dirname, '../../public', image.path);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await Deposit.findByIdAndDelete(req.params.id);
    
    req.flash('success_msg', 'Deposit deleted successfully');
    res.redirect('/deposits');
  } catch (err) {
    console.error('Error deleting deposit:', err);
    req.flash('error_msg', 'Error deleting deposit');
    res.redirect('/deposits');
  }
};

// Scan image for barcodes and text
exports.scanImage = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.depositId);
    
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found' });
    }
    
    // Check if deposit belongs to user if not admin
    if (req.user.role !== 'admin' && deposit.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // Find the image in the deposit
    const image = deposit.images.find(img => img._id.toString() === req.params.imageId);
    
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    
    // Get the full path to the image
    const imagePath = path.join(__dirname, '../../public', image.path);
    
    // Use Tesseract to extract text from image
    const extractedText = await barcodeScanner.scanImage(imagePath);
    
    // Parse device information from the text
    const deviceInfo = barcodeScanner.parseDeviceInfo(extractedText);
    
    res.json({
      success: true,
      text: extractedText,
      deviceInfo
    });
  } catch (err) {
    console.error('Image scanning error:', err);
    res.status(500).json({ success: false, message: 'Error scanning image', error: err.message });
  }
}; 