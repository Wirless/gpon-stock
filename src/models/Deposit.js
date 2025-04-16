/**
 * Deposit model
 * Stores information about devices deposited by installators
 * Including various serial numbers and device information
 */
const mongoose = require('mongoose');

const DepositSchema = new mongoose.Schema({
  // Reference to user who created the deposit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Device information
  deviceInfo: {
    model: {
      type: String,
      trim: true
    },
    partNumber: {
      type: String,
      trim: true
    },
    manufactureDate: {
      type: String,
      trim: true
    }
  },
  // Serial numbers and identifiers
  serialNumbers: {
    productionSN: {
      type: String,
      trim: true
    },
    gponSN: {
      type: String,
      trim: true
    },
    gponSNHex: {
      type: String,
      trim: true
    },
    wanMAC: {
      type: String,
      trim: true
    },
    voipMAC: {
      type: String,
      trim: true
    }
  },
  // Additional notes
  notes: {
    type: String,
    trim: true
  },
  // Image paths (stored locally or in cloud)
  images: [{
    path: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'processed', 'rejected'],
    default: 'pending'
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
DepositSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Deposit', DepositSchema); 