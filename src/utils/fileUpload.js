/**
 * File upload utility
 * Configures Multer for handling image uploads
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a folder for user if it doesn't exist
    const userFolder = path.join(uploadDir, req.user._id.toString());
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }
    
    // Create a folder for the current deposit if deposit ID is provided
    if (req.body.depositId) {
      const depositFolder = path.join(userFolder, req.body.depositId);
      if (!fs.existsSync(depositFolder)) {
        fs.mkdirSync(depositFolder, { recursive: true });
      }
      cb(null, depositFolder);
    } else {
      cb(null, userFolder);
    }
  },
  filename: (req, file, cb) => {
    // Create a unique filename with timestamp + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  
  // Check file extension and mimetype
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Images only! (jpeg, jpg, png, gif)'));
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB file size limit
  fileFilter: fileFilter
});

module.exports = upload; 