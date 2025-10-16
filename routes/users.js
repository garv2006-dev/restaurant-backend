const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Middleware
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
    getProfile,
    updateProfile,
    uploadAvatar,
    getDashboard,
    updatePreferences,
    deleteAccount,
    getUsers,
    getUser,
    updateUser
} = require('../controllers/userController');

// Configure multer for avatar upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/avatars/');
    },
    filename: function (req, file, cb) {
        cb(null, `avatar-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// All routes require authentication except admin routes
router.use(protect);

// User profile routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.get('/dashboard', getDashboard);
router.put('/preferences', updatePreferences);
router.delete('/account', deleteAccount);

// Admin routes
router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin'), getUser);
router.put('/:id', authorize('admin'), updateUser);

module.exports = router;