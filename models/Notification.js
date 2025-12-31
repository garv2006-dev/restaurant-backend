const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Notification must belong to a user']
    },
    title: {
        type: String,
        required: [true, 'Notification must have a title'],
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    message: {
        type: String,
        required: [true, 'Notification must have a message'],
        maxlength: [500, 'Message cannot exceed 500 characters']
    },
    type: {
        type: String,
        enum: ['room_booking', 'promotion', 'system', 'payment'],
        required: [true, 'Notification must have a type']
    },
    relatedRoomBookingId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Booking',
        default: null
    },
    roomId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Room',
        default: null
    },
    bookingStatus: {
        type: String,
        enum: ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow'],
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ relatedRoomBookingId: 1 });

// Compound indexes for idempotency checks (prevent duplicates)
NotificationSchema.index({ userId: 1, type: 1, relatedRoomBookingId: 1, bookingStatus: 1 }); // Room bookings
NotificationSchema.index({ userId: 1, type: 1, relatedRoomBookingId: 1, title: 1 }); // Payments
NotificationSchema.index({ userId: 1, type: 1, title: 1, message: 1 }); // Promotions & System

// Static method to create room booking notifications (IDEMPOTENT)
NotificationSchema.statics.createRoomBookingNotification = async function(data) {
    const {
        userId,
        title,
        message,
        bookingStatus,
        relatedRoomBookingId,
        roomId
    } = data;

    // Check if notification already exists for this booking and status
    // This prevents duplicate notifications on page reload
    const existingNotification = await this.findOne({
        userId,
        type: 'room_booking',
        relatedRoomBookingId,
        bookingStatus
    }).maxTimeMS(3000).lean();

    if (existingNotification) {
        console.log(`Notification already exists for booking ${relatedRoomBookingId} with status ${bookingStatus}`);
        return existingNotification;
    }

    return await this.create({
        userId,
        title,
        message,
        type: 'room_booking',
        bookingStatus,
        relatedRoomBookingId,
        roomId
    });
};

// Static method to create payment notifications (IDEMPOTENT)
NotificationSchema.statics.createPaymentNotification = async function(data) {
    const {
        userId,
        title,
        message,
        relatedRoomBookingId,
        roomId,
        paymentStatus
    } = data;

    // Check if notification already exists for this booking and payment status
    // This prevents duplicate notifications on page reload
    const existingNotification = await this.findOne({
        userId,
        type: 'payment',
        relatedRoomBookingId,
        title // Use title to differentiate between success/failure
    }).maxTimeMS(3000).lean();

    if (existingNotification) {
        console.log(`Payment notification already exists for booking ${relatedRoomBookingId}`);
        return existingNotification;
    }

    return await this.create({
        userId,
        title,
        message,
        type: 'payment',
        relatedRoomBookingId,
        roomId
    });
};

// Static method to create promotion notifications (IDEMPOTENT)
NotificationSchema.statics.createPromotionNotification = async function(data) {
    const {
        userId,
        title,
        message,
        promotionId // Add promotionId to track unique promotions
    } = data;

    // Check if notification already exists for this promotion
    // This prevents duplicate notifications on page reload
    if (promotionId) {
        const existingNotification = await this.findOne({
            userId,
            type: 'promotion',
            title,
            message
        }).maxTimeMS(3000).lean();

        if (existingNotification) {
            console.log(`Promotion notification already exists for user ${userId}`);
            return existingNotification;
        }
    }

    return await this.create({
        userId,
        title,
        message,
        type: 'promotion'
    });
};

// Static method to create system notifications (IDEMPOTENT)
NotificationSchema.statics.createSystemNotification = async function(data) {
    const {
        userId,
        title,
        message,
        systemEventId // Add systemEventId to track unique system events
    } = data;

    // Check if notification already exists for this system event
    // This prevents duplicate notifications on page reload
    if (systemEventId) {
        const existingNotification = await this.findOne({
            userId,
            type: 'system',
            title,
            message
        }).maxTimeMS(3000).lean();

        if (existingNotification) {
            console.log(`System notification already exists for user ${userId}`);
            return existingNotification;
        }
    }

    return await this.create({
        userId,
        title,
        message,
        type: 'system'
    });
};

// Instance method to mark as read
NotificationSchema.methods.markAsRead = function() {
    this.isRead = true;
    return this.save();
};

// Static method to get unread count for user
NotificationSchema.statics.getUnreadCount = async function(userId) {
    return await this.countDocuments({ userId, isRead: false }).maxTimeMS(3000);
};

// Static method to mark all as read for user
NotificationSchema.statics.markAllAsRead = async function(userId) {
    return await this.updateMany(
        { userId, isRead: false },
        { isRead: true }
    ).maxTimeMS(5000);
};

// Static method to clear all notifications for user
NotificationSchema.statics.clearAll = async function(userId) {
    return await this.deleteMany({ userId }).maxTimeMS(5000);
};

// Static method to get notifications with pagination
NotificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
    const {
        page = 1,
        limit = 10,
        type,
        isRead,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = options;

    const query = { userId };
    
    if (type) query.type = type;
    if (typeof isRead === 'boolean') query.isRead = isRead;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Use Promise.all to run queries in parallel and add maxTimeMS to prevent timeouts
    const [notifications, total] = await Promise.all([
        this.find(query)
            .populate('relatedRoomBookingId', 'bookingId status')
            .populate('roomId', 'name roomNumber type')
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .maxTimeMS(5000) // 5 second timeout
            .lean(), // Convert to plain JS objects for better performance
        this.countDocuments(query).maxTimeMS(5000)
    ]);

    return {
        notifications,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

module.exports = mongoose.model('Notification', NotificationSchema);
