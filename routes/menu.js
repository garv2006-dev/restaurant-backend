const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    getMenuItems,
    getMenuItem,
    getMenuCategories,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability
} = require('../controllers/menuController');

// Public routes
router.get('/', getMenuItems);
router.get('/categories', getMenuCategories);
router.get('/:id', getMenuItem);

// Admin routes
router.post('/', protect, authorize('admin'), createMenuItem);
router.put('/:id', protect, authorize('admin'), updateMenuItem);
router.delete('/:id', protect, authorize('admin'), deleteMenuItem);
router.put('/:id/toggle-availability', protect, authorize('admin'), toggleAvailability);

module.exports = router;