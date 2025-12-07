const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    getDashboardStats,
    getAllBookings,
    getAllOrders,
    getAllUsers,
    updateBookingStatus,
    updateUserStatus,
    getRevenueAnalytics,
    generateReports,
    getSystemSettings,
    createStaffUser
} = require('../controllers/adminController');

const {
    getAnalyticsReport,
    exportReport,
    getLiveDashboard
} = require('../controllers/reportController');

// All routes require admin authorization
router.use(protect, authorize('admin'));

// Dashboard routes
router.get('/dashboard', getDashboardStats);
router.get('/dashboard/live', getLiveDashboard);
router.get('/analytics/revenue', getRevenueAnalytics);

// Booking management
router.get('/bookings', getAllBookings);
router.put('/bookings/:id/status', updateBookingStatus);

// Order management
router.get('/orders', getAllOrders);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

// Reports
router.get('/reports', getAnalyticsReport);
router.get('/reports/export', exportReport);
router.get('/reports/legacy', generateReports); // Keep existing reports for backward compatibility

// System settings
router.get('/settings', getSystemSettings);

// Staff management
router.post('/staff', createStaffUser);

module.exports = router;