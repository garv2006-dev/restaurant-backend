const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    createPaymentIntent,
    confirmPayment,
    createPayment,
    getPayments,
    getPayment,
    getAllPayments,
    processRefund,
    generateInvoice,
    createRazorpayOrder,
    verifyRazorpayPayment
} = require('../controllers/paymentController');

// All routes require authentication
router.use(protect);

// Customer routes
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);
router.post('/create', createPayment);
router.get('/', getPayments);
router.get('/:id', getPayment);
router.get('/:id/invoice', generateInvoice);

// Razorpay routes
router.post('/razorpay/create-order', createRazorpayOrder);
router.post('/razorpay/verify', verifyRazorpayPayment);

// Admin routes
router.get('/admin/all', authorize('admin'), getAllPayments);
router.post('/:id/refund', authorize('admin'), processRefund);

module.exports = router;