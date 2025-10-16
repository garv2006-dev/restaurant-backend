const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getActiveDiscounts,
  validateDiscount,
  applyDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getAllDiscountsAdmin
} = require('../controllers/discountController');

// Public routes
router.get('/', getActiveDiscounts);

// Protected routes
router.post('/validate', protect, validateDiscount);
router.post('/apply', protect, applyDiscount);

// Admin routes
router.get('/admin', protect, authorize('admin'), getAllDiscountsAdmin);
router.post('/', protect, authorize('admin'), createDiscount);
router.put('/:id', protect, authorize('admin'), updateDiscount);
router.delete('/:id', protect, authorize('admin'), deleteDiscount);

module.exports = router;