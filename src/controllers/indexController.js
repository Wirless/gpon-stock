/**
 * Index Controller
 * Handles homepage, dashboard and other general pages
 */
const Deposit = require('../models/Deposit');
const User = require('../models/User');

// Render homepage
exports.getHomePage = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('index', {
    title: 'Stock Management System'
  });
};

// Render dashboard
exports.getDashboard = async (req, res) => {
  try {
    let userStats = {};
    let recentDeposits = [];
    let query = {};
    
    // If not admin, only show user's own deposits
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }
    
    // Get recent deposits
    recentDeposits = await Deposit.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get stats based on user role
    if (req.user.role === 'admin') {
      // Admin dashboard stats
      const totalUsers = await User.countDocuments();
      const totalInstallators = await User.countDocuments({ role: 'installator' });
      const totalDeposits = await Deposit.countDocuments();
      const pendingDeposits = await Deposit.countDocuments({ status: 'pending' });
      const processedDeposits = await Deposit.countDocuments({ status: 'processed' });
      const rejectedDeposits = await Deposit.countDocuments({ status: 'rejected' });
      
      userStats = {
        totalUsers,
        totalInstallators,
        totalDeposits,
        pendingDeposits,
        processedDeposits,
        rejectedDeposits
      };
    } else {
      // Installator dashboard stats
      const totalDeposits = await Deposit.countDocuments({ createdBy: req.user._id });
      const pendingDeposits = await Deposit.countDocuments({ 
        createdBy: req.user._id,
        status: 'pending'
      });
      const processedDeposits = await Deposit.countDocuments({ 
        createdBy: req.user._id,
        status: 'processed'
      });
      const rejectedDeposits = await Deposit.countDocuments({ 
        createdBy: req.user._id,
        status: 'rejected'
      });
      
      userStats = {
        totalDeposits,
        pendingDeposits,
        processedDeposits,
        rejectedDeposits
      };
    }
    
    res.render('dashboard', {
      title: 'Dashboard',
      userStats,
      recentDeposits
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.render('dashboard', {
      title: 'Dashboard',
      userStats: {},
      recentDeposits: []
    });
  }
}; 