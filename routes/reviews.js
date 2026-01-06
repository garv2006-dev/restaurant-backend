const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    createReview,
    getReviews,
    getMyReviews,
    updateReview,
    deleteReview,
    moderateReview,
    getPendingReviews,
    canReviewBooking
} = require('../controllers/reviewController');

// Public routes
router.get('/', getReviews);

// Protected routes
router.use(protect);
router.post('/', createReview);
router.get('/my-reviews', getMyReviews);
router.get('/can-review/:bookingId', canReviewBooking);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

// Admin routes
router.get('/pending', authorize('admin'), getPendingReviews);
router.put('/:id/moderate', authorize('admin'), moderateReview);

module.exports = router;