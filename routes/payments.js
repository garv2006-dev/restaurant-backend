const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    createPaymentIntent,
    confirmPayment,
    getPayments,
    getPayment,
    processRefund,
    generateInvoice
} = require('../controllers/paymentController');

// All routes require authentication
router.use(protect);

// Customer routes
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.get('/', getPayments);
router.get('/:id', getPayment);
router.get('/:id/invoice', generateInvoice);

// Admin routes
router.post('/:id/refund', authorize('admin'), processRefund);

module.exports = router;