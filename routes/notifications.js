const express = require('express');
const router = express.Router();
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    createPromotionNotification,
    createSystemNotification
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// User notification routes
router.route('/')
    .get(getNotifications);

router.route('/unread-count')
    .get(getUnreadCount);

router.route('/mark-all-read')
    .put(markAllAsRead);

router.route('/clear-all')
    .delete(clearAllNotifications);

router.route('/:id/read')
    .put(markAsRead);

router.route('/:id')
    .delete(deleteNotification);

// Admin only routes for creating notifications
router.use(authorize('admin'));

router.route('/promotion')
    .post(createPromotionNotification);

router.route('/system')
    .post(createSystemNotification);

module.exports = router;
