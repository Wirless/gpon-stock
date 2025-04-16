/**
 * Image Storage Utility
 * Handles storing and managing images in the local filesystem
 */
const fs = require('fs');
const path = require('path');

// Base upload directory
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/scanned');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('Created uploads directory:', UPLOAD_DIR);
}

/**
 * Save a base64 image to the local filesystem
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} prefix - Optional prefix for the filename
 * @returns {Object} Object containing path and url to the saved image
 */
const saveBase64Image = (base64Data, prefix = 'scan') => {
  try {
    // Strip out the data:image/jpeg;base64, part
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Create a unique filename
    const filename = `${prefix}_${Date.now()}.jpg`;
    const filePath = path.join(UPLOAD_DIR, filename);
    
    // Write the file
    fs.writeFileSync(filePath, buffer);
    
    // Return file information
    const relativePath = path.join('/uploads/scanned', filename);
    return {
      filePath,           // Absolute file path for internal use
      publicUrl: relativePath, // Relative URL for public access
      filename
    };
  } catch (error) {
    console.error('Error saving base64 image:', error);
    throw error;
  }
};

/**
 * Delete an image from the filesystem
 * @param {string} filename - Name of the file to delete
 * @returns {boolean} True if deletion was successful
 */
const deleteImage = (filename) => {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

module.exports = {
  saveBase64Image,
  deleteImage,
  UPLOAD_DIR
}; 