const express = require('express');
const router = express.Router();

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    createRoomNumbers,
    getRoomNumbers,
    getRoomNumber,
    updateRoomNumberStatus,
    allocateRoomNumber,
    deallocateRoomNumber,
    getAvailableRoomNumbers,
    updateRoomNumber,
    deleteRoomNumber
} = require('../controllers/roomNumberController');

// Public/Internal routes
router.get('/available', getAvailableRoomNumbers);

// Admin/Staff routes (all require authentication)
router.use(protect);

router.post('/bulk-create', authorize('admin'), createRoomNumbers);
router.get('/', authorize('admin', 'staff'), getRoomNumbers);
router.get('/:id', authorize('admin', 'staff'), getRoomNumber);
router.put('/:id', authorize('admin'), updateRoomNumber);
router.delete('/:id', authorize('admin'), deleteRoomNumber);
router.put('/:id/status', authorize('admin'), updateRoomNumberStatus);
router.post('/:id/allocate', authorize('admin', 'staff'), allocateRoomNumber);
router.post('/:id/deallocate', authorize('admin', 'staff'), deallocateRoomNumber);

module.exports = router;
