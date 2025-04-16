/**
 * Database Seeder
 * 
 * This script populates the database with initial data
 * Creates an admin user if one doesn't exist
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Default admin credentials
const DEFAULT_ADMIN = {
  name: 'Administrator',
  email: 'admin@example.com',
  password: 'admin123',
  role: 'admin'
};

// Developer admin credentials
const DEVELOPER_ADMIN = {
  name: 'Developer',
  email: 'developer@example.com',
  password: 'admin1234',
  role: 'admin'
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-management')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

// Seed database
const seedDatabase = async () => {
  try {
    // Check if admin user exists
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      // Create admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, salt);
      
      const admin = new User({
        name: DEFAULT_ADMIN.name,
        email: DEFAULT_ADMIN.email,
        password: hashedPassword,
        role: DEFAULT_ADMIN.role
      });
      
      await admin.save();
      console.log('Admin user created:');
      console.log(`Email: ${DEFAULT_ADMIN.email}`);
      console.log(`Password: ${DEFAULT_ADMIN.password}`);
    } else {
      console.log('Admin user already exists');
    }
    
    // Check if developer admin exists
    const devAdminExists = await User.findOne({ email: DEVELOPER_ADMIN.email });
    
    if (!devAdminExists) {
      // Create developer admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(DEVELOPER_ADMIN.password, salt);
      
      const devAdmin = new User({
        name: DEVELOPER_ADMIN.name,
        email: DEVELOPER_ADMIN.email,
        password: hashedPassword,
        role: DEVELOPER_ADMIN.role
      });
      
      await devAdmin.save();
      console.log('Developer admin user created:');
      console.log(`Email: ${DEVELOPER_ADMIN.email}`);
      console.log(`Password: ${DEVELOPER_ADMIN.password}`);
    } else {
      // Update the developer admin password to ensure it's correct
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(DEVELOPER_ADMIN.password, salt);
      
      await User.findOneAndUpdate(
        { email: DEVELOPER_ADMIN.email },
        { 
          $set: { 
            password: hashedPassword 
          }
        }
      );
      console.log('Developer admin password updated to:');
      console.log(`Email: ${DEVELOPER_ADMIN.email}`);
      console.log(`Password: ${DEVELOPER_ADMIN.password}`);
    }
    
    console.log('Database seeding completed');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

// Run the seeder
seedDatabase(); 