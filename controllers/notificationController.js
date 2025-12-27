const Notification = require('../models/Notification');
const { emitUserNotification } = require('../config/socket');

// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 10, type, isRead } = req.query;

        const result = await Notification.getUserNotifications(req.user.id, {
            page: Number(page),
            limit: Number(limit),
            type,
            isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined
        });

        res.status(200).json({
            success: true,
            data: result.notifications,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get unread count for logged-in user
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await Notification.getUnreadCount(req.user.id);

        res.status(200).json({
            success: true,
            data: { unreadCount }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Check if notification belongs to user
        if (notification.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this notification'
            });
        }

        await notification.markAsRead();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Mark all notifications as read for user
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = async (req, res) => {
    try {
        await Notification.markAllAsRead(req.user.id);

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Check if notification belongs to user
        if (notification.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this notification'
            });
        }

        await notification.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Clear all notifications for user
// @route   DELETE /api/notifications/clear-all
// @access  Private
const clearAllNotifications = async (req, res) => {
    try {
        await Notification.clearAll(req.user.id);

        res.status(200).json({
            success: true,
            message: 'All notifications cleared successfully'
        });
    } catch (error) {
        console.error('Clear all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create room booking notification (internal use)
// @access  Private/Admin (for internal calls)
const createRoomBookingNotification = async (userId, bookingData, action) => {
    try {
        const { booking, room, status } = bookingData;
        
        let title, message, bookingStatus;

        switch (action) {
            case 'created':
                title = 'Room Booking Pending';
                message = `Your room booking ${booking.bookingId} for ${room.name} is pending confirmation.`;
                bookingStatus = 'pending';
                break;
            case 'confirmed':
                title = 'Room Booking Confirmed';
                message = `Your room booking ${booking.bookingId} for ${room.name} has been confirmed!`;
                bookingStatus = 'confirmed';
                break;
            case 'cancelled_by_user':
                title = 'Room Booking Cancelled';
                message = `Your room booking ${booking.bookingId} for ${room.name} has been cancelled.`;
                bookingStatus = 'cancelled';
                break;
            case 'cancelled_by_admin':
                title = 'Room Booking Cancelled by Admin';
                message = `Your room booking ${booking.bookingId} for ${room.name} has been cancelled by the administrator.`;
                bookingStatus = 'cancelled';
                break;
            case 'updated':
                title = 'Room Booking Updated';
                message = `Your room booking ${booking.bookingId} details have been updated.`;
                bookingStatus = booking.status;
                break;
            default:
                title = 'Room Booking Update';
                message = `There is an update regarding your room booking ${booking.bookingId}.`;
                bookingStatus = booking.status;
        }

        const notification = await Notification.createRoomBookingNotification({
            userId,
            title,
            message,
            bookingStatus,
            relatedRoomBookingId: booking._id,
            roomId: room._id
        });

        // Emit real-time notification
        try {
            emitUserNotification(userId, {
                title,
                message,
                type: 'room_booking',
                bookingId: booking.bookingId,
                notificationId: notification._id
            });
        } catch (socketError) {
            console.error('Socket notification error:', socketError);
        }

        return notification;
    } catch (error) {
        console.error('Create room booking notification error:', error);
        throw error;
    }
};

// @desc    Create payment notification (internal use)
// @access  Private/Admin (for internal calls)
const createPaymentNotification = async (userId, bookingData, paymentStatus) => {
    try {
        const { booking, room } = bookingData;
        
        let title, message;

        if (paymentStatus === 'completed' || paymentStatus === 'Paid') {
            title = 'Payment Successful';
            message = `Payment of ₹${booking.pricing.totalAmount.toFixed(2)} for booking ${booking.bookingId} has been successfully processed.`;
        } else if (paymentStatus === 'failed' || paymentStatus === 'Failed') {
            title = 'Payment Failed';
            message = `Payment for booking ${booking.bookingId} has failed. Please try again or contact support.${booking.pricing.totalAmount ? ` Amount: ₹${booking.pricing.totalAmount.toFixed(2)}` : ''}`;
        } else {
            title = 'Payment Update';
            message = `There is an update regarding payment for your booking ${booking.bookingId}.`;
        }

        const notification = await Notification.createPaymentNotification({
            userId,
            title,
            message,
            relatedRoomBookingId: booking._id,
            roomId: room._id
        });

        // Emit real-time notification
        try {
            emitUserNotification(userId, {
                title,
                message,
                type: 'payment',
                bookingId: booking.bookingId,
                notificationId: notification._id
            });
        } catch (socketError) {
            console.error('Socket notification error:', socketError);
        }

        return notification;
    } catch (error) {
        console.error('Create payment notification error:', error);
        throw error;
    }
};

// @desc    Create promotion notification (Admin only)
// @route   POST /api/notifications/promotion
// @access  Private/Admin
const createPromotionNotification = async (req, res) => {
    try {
        const { userIds, title, message } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required'
            });
        }

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required'
            });
        }

        const notifications = [];
        
        for (const userId of userIds) {
            try {
                const notification = await Notification.createPromotionNotification({
                    userId,
                    title,
                    message
                });

                // Emit real-time notification
                try {
                    emitUserNotification(userId, {
                        title,
                        message,
                        type: 'promotion',
                        notificationId: notification._id
                    });
                } catch (socketError) {
                    console.error('Socket notification error:', socketError);
                }

                notifications.push(notification);
            } catch (error) {
                console.error(`Error creating promotion notification for user ${userId}:`, error);
            }
        }

        res.status(201).json({
            success: true,
            data: notifications,
            message: `Promotion notifications sent to ${notifications.length} users`
        });
    } catch (error) {
        console.error('Create promotion notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create system notification (Admin only)
// @route   POST /api/notifications/system
// @access  Private/Admin
const createSystemNotification = async (req, res) => {
    try {
        const { userIds, title, message } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required'
            });
        }

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required'
            });
        }

        const notifications = [];
        
        for (const userId of userIds) {
            try {
                const notification = await Notification.createSystemNotification({
                    userId,
                    title,
                    message
                });

                // Emit real-time notification
                try {
                    emitUserNotification(userId, {
                        title,
                        message,
                        type: 'system',
                        notificationId: notification._id
                    });
                } catch (socketError) {
                    console.error('Socket notification error:', socketError);
                }

                notifications.push(notification);
            } catch (error) {
                console.error(`Error creating system notification for user ${userId}:`, error);
            }
        }

        res.status(201).json({
            success: true,
            data: notifications,
            message: `System notifications sent to ${notifications.length} users`
        });
    } catch (error) {
        console.error('Create system notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    createRoomBookingNotification,
    createPaymentNotification,
    createPromotionNotification,
    createSystemNotification
};
