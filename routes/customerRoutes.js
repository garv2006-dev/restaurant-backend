const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
  getCustomers,
  addCustomer
} = require('../controllers/customerController');

// All routes require admin authorization
router.use(protect, authorize('admin'));

// Customer routes
router.get('/', getCustomers);
router.post('/', addCustomer);

module.exports = router;
