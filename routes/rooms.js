const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    getRooms,
    getRoom,
    checkAvailability,
    createRoom,
    updateRoom,
    deleteRoom,
    getRoomTypes
} = require('../controllers/roomController');

// Public routes
router.get('/', getRooms);
router.get('/types', getRoomTypes);
router.get('/:id', getRoom);
router.post('/:id/availability', checkAvailability);

// Admin routes
router.post('/', protect, authorize('admin'), createRoom);
router.put('/:id', protect, authorize('admin'), updateRoom);
router.delete('/:id', protect, authorize('admin'), deleteRoom);

module.exports = router;