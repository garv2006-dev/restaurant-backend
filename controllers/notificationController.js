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
                title = '🏨 New Booking Created';
                message = `Your room booking ${booking.bookingId} for ${room.name} has been created and is pending confirmation.`;
                bookingStatus = 'Pending';
                break;
            case 'confirmed':
            case 'confirmed_by_admin':
                title = '✅ Booking Confirmed!';
                message = `Great news! Your room booking ${booking.bookingId} for ${room.name} has been confirmed by our team.`;
                bookingStatus = 'Confirmed';
                break;
            case 'cancelled_by_user':
                title = '❌ Booking Cancelled';
                message = `Your room booking ${booking.bookingId} for ${room.name} has been cancelled as requested.`;
                bookingStatus = 'Cancelled';
                break;
            case 'cancelled_by_admin':
                title = '⚠️ Booking Cancelled by Admin';
                message = `Your room booking ${booking.bookingId} for ${room.name} has been cancelled by our administrator. Please contact support for details.`;
                bookingStatus = 'Cancelled';
                break;
            case 'checked_in':
                title = '🔑 Check-in Completed';
                message = `Welcome! You have successfully checked in for booking ${booking.bookingId} at ${room.name}.`;
                bookingStatus = 'CheckedIn';
                break;
            case 'checked_out':
                title = '👋 Check-out Completed';
                message = `Thank you for staying with us! Check-out completed for booking ${booking.bookingId}. We hope you enjoyed your stay.`;
                bookingStatus = 'CheckedOut';
                break;
            case 'updated':
                title = '📝 Booking Updated';
                message = `Your room booking ${booking.bookingId} details have been updated. Please review the changes.`;
                bookingStatus = booking.status;
                break;
            case 'payment_pending':
                title = '💳 Payment Required';
                message = `Payment is required for your booking ${booking.bookingId}. Please complete payment to confirm your reservation.`;
                bookingStatus = 'Pending';
                break;
            case 'payment_completed':
                title = '✅ Payment Successful';
                message = `Payment completed successfully for booking ${booking.bookingId}. Your reservation is now confirmed!`;
                bookingStatus = 'Confirmed';
                break;
            case 'no_show':
                title = '⏰ No Show Recorded';
                message = `Your booking ${booking.bookingId} has been marked as no-show. Please contact us if this is incorrect.`;
                bookingStatus = 'NoShow';
                break;
            default:
                title = '📢 Booking Update';
                message = `There is an update regarding your room booking ${booking.bookingId}.`;
                bookingStatus = booking.status;
        }

        // Create notification with idempotency check
        const notification = await Notification.createRoomBookingNotification({
            userId,
            title,
            message,
            bookingStatus,
            relatedRoomBookingId: booking._id,
            roomId: room._id
        });

        // CRITICAL: Only emit socket event if notification was NEWLY created
        // Check if notification was just created (within last 2 seconds)
        const isNewNotification = notification.createdAt && 
            (Date.now() - new Date(notification.createdAt).getTime()) < 2000;

        if (isNewNotification) {
            // Emit real-time notification ONLY for new notifications
            try {
                emitUserNotification(userId, {
                    title,
                    message,
                    type: 'room_booking',
                    bookingId: booking.bookingId,
                    notificationId: notification._id,
                    action: action,
                    status: bookingStatus,
                    createdAt: notification.createdAt
                });
                console.log(`NEW notification created and emitted for user ${userId}: ${title}`);
            } catch (socketError) {
                console.error('Socket notification error:', socketError);
            }
        } else {
            console.log(`Notification already existed for user ${userId}, skipping socket emit`);
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

        // Create notification with idempotency check
        const notification = await Notification.createPaymentNotification({
            userId,
            title,
            message,
            relatedRoomBookingId: booking._id,
            roomId: room._id,
            paymentStatus
        });

        // CRITICAL: Only emit socket event if notification was NEWLY created
        // Check if notification was just created (within last 2 seconds)
        const isNewNotification = notification.createdAt && 
            (Date.now() - new Date(notification.createdAt).getTime()) < 2000;

        if (isNewNotification) {
            // Emit real-time notification ONLY for new notifications
            try {
                emitUserNotification(userId, {
                    title,
                    message,
                    type: 'payment',
                    bookingId: booking.bookingId,
                    notificationId: notification._id,
                    createdAt: notification.createdAt
                });
                console.log(`NEW payment notification created and emitted for user ${userId}`);
            } catch (socketError) {
                console.error('Socket notification error:', socketError);
            }
        } else {
            console.log(`Payment notification already existed for user ${userId}, skipping socket emit`);
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
        const { userIds, title, message, promotionId } = req.body;

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
        const newNotifications = [];
        
        for (const userId of userIds) {
            try {
                // Create notification with idempotency check
                const notification = await Notification.createPromotionNotification({
                    userId,
                    title,
                    message,
                    promotionId
                });

                notifications.push(notification);

                // CRITICAL: Only emit socket event if notification was NEWLY created
                const isNewNotification = notification.createdAt && 
                    (Date.now() - new Date(notification.createdAt).getTime()) < 2000;

                if (isNewNotification) {
                    // Emit real-time notification ONLY for new notifications
                    try {
                        emitUserNotification(userId, {
                            title,
                            message,
                            type: 'promotion',
                            notificationId: notification._id,
                            createdAt: notification.createdAt
                        });
                        newNotifications.push(notification);
                    } catch (socketError) {
                        console.error('Socket notification error:', socketError);
                    }
                }
            } catch (error) {
                console.error(`Error creating promotion notification for user ${userId}:`, error);
            }
        }

        res.status(201).json({
            success: true,
            data: notifications,
            message: `Promotion notifications sent to ${newNotifications.length} new users (${notifications.length} total)`
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
        const { userIds, title, message, systemEventId } = req.body;

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
        const newNotifications = [];
        
        for (const userId of userIds) {
            try {
                // Create notification with idempotency check
                const notification = await Notification.createSystemNotification({
                    userId,
                    title,
                    message,
                    systemEventId
                });

                notifications.push(notification);

                // CRITICAL: Only emit socket event if notification was NEWLY created
                const isNewNotification = notification.createdAt && 
                    (Date.now() - new Date(notification.createdAt).getTime()) < 2000;

                if (isNewNotification) {
                    // Emit real-time notification ONLY for new notifications
                    try {
                        emitUserNotification(userId, {
                            title,
                            message,
                            type: 'system',
                            notificationId: notification._id,
                            createdAt: notification.createdAt
                        });
                        newNotifications.push(notification);
                    } catch (socketError) {
                        console.error('Socket notification error:', socketError);
                    }
                }
            } catch (error) {
                console.error(`Error creating system notification for user ${userId}:`, error);
            }
        }

        res.status(201).json({
            success: true,
            data: notifications,
            message: `System notifications sent to ${newNotifications.length} new users (${notifications.length} total)`
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
