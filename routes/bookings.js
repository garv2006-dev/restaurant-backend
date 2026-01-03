const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    validateDiscountForBooking,
    createBooking,
    getBookings,
    getAllBookings,
    getBooking,
    updateBooking,
    cancelBooking,
    confirmBooking,
    checkInBooking,
    checkOutBooking
} = require('../controllers/bookingController');

// All routes require authentication
router.use(protect);

// Admin routes (must come before generic /:id route)
router.get('/admin/all', authorize('admin', 'staff'), getAllBookings);

// Customer routes
router.post('/validate-discount', validateDiscountForBooking);
router.post('/', createBooking);
router.get('/', getBookings);
router.get('/:id', getBooking);
router.put('/:id', updateBooking);
router.put('/:id/cancel', cancelBooking);

// Admin/Staff routes
router.put('/:id/confirm', authorize('admin', 'staff'), confirmBooking);
router.put('/:id/checkin', authorize('admin', 'staff'), checkInBooking);
router.put('/:id/checkout', authorize('admin', 'staff'), checkOutBooking);

module.exports = router;