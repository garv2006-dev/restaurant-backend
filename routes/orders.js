const express = require('express');
const router = express.Router();

const { createOrder, getUserOrders, getOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, createOrder);

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
router.get('/', protect, getUserOrders);

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, getOrder);

module.exports = router;
