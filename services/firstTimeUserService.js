const User = require('../models/User');
const Booking = require('../models/Booking');
const Discount = require('../models/Discount');
const Notification = require('../models/Notification');
const { emitUserNotification } = require('../config/socket');

/**
 * Check if user is eligible for first-time discount
 * Conditions:
 * - User has never received first-time discount notification
 * - User has zero completed bookings
 * - User account was recently created (within last 30 days)
 */
const isEligibleForFirstTimeDiscount = async (userId) => {
    try {
        const user = await User.findById(userId);
        
        if (!user) {
            return false;
        }

        // Check if discount was already sent
        if (user.firstLoginDiscountSent) {
            console.log(`User ${userId} already received first-time discount`);
            return false;
        }

        // Check if user has any completed bookings
        const completedBookingsCount = await Booking.countDocuments({
            user: userId,
            status: { $in: ['Confirmed', 'CheckedIn', 'CheckedOut'] }
        });

        if (completedBookingsCount > 0) {
            console.log(`User ${userId} has ${completedBookingsCount} completed bookings`);
            return false;
        }

        // Check if account is new (within 30 days)
        const accountAge = Date.now() - new Date(user.createdAt).getTime();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        
        if (accountAge > thirtyDaysInMs) {
            console.log(`User ${userId} account is older than 30 days`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking first-time discount eligibility:', error);
        return false;
    }
};

/**
 * Find an active first-time user discount
 * Looks for discounts with specific criteria for new users
 */
const findFirstTimeUserDiscount = async () => {
    try {
        const now = new Date();
        
        // First, try to find discount explicitly marked as first-time user discount
        let discount = await Discount.findOne({
            isActive: true,
            isFirstTimeUserDiscount: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
            'usageLimit.perUser': 1, // One-time use per user
        }).sort({ createdAt: -1 }); // Get the most recent one

        // If not found, fall back to name/description matching
        if (!discount) {
            discount = await Discount.findOne({
                isActive: true,
                validFrom: { $lte: now },
                validUntil: { $gte: now },
                'usageLimit.perUser': 1, // One-time use per user
                $or: [
                    { name: /first.*user/i }, // Matches "First User", "First Time User", etc.
                    { name: /welcome/i },      // Matches "Welcome Offer", etc.
                    { description: /first.*booking/i } // Matches descriptions with "first booking"
                ]
            }).sort({ createdAt: -1 }); // Get the most recent one
        }

        return discount;
    } catch (error) {
        console.error('Error finding first-time user discount:', error);
        return null;
    }
};

/**
 * Send first-time discount notification to user
 * This is the main function called after login
 */
const sendFirstTimeDiscountNotification = async (userId) => {
    try {
        // Check eligibility
        const isEligible = await isEligibleForFirstTimeDiscount(userId);
        
        if (!isEligible) {
            return {
                success: false,
                message: 'User not eligible for first-time discount'
            };
        }

        // Find appropriate discount
        const discount = await findFirstTimeUserDiscount();
        
        if (!discount) {
            console.log('No first-time user discount available');
            return {
                success: false,
                message: 'No first-time discount available'
            };
        }

        // Create notification message
        const discountValue = discount.type === 'percentage' 
            ? `${discount.value}%` 
            : `₹${discount.value}`;
        
        const title = '🎉 Welcome! First Booking Discount';
        const message = `Use code ${discount.code} to get ${discountValue} off your first room booking. This code is valid for one-time use only.`;

        // Create notification with idempotency check
        const notification = await Notification.createPromotionNotification({
            userId,
            title,
            message,
            promotionId: `first-time-${discount._id}` // Unique identifier
        });

        // Check if notification was newly created
        const isNewNotification = notification.createdAt && 
            (Date.now() - new Date(notification.createdAt).getTime()) < 2000;

        if (!isNewNotification) {
            console.log(`First-time discount notification already exists for user ${userId}`);
            return {
                success: false,
                message: 'Notification already sent'
            };
        }

        // Mark user as having received the discount
        await User.findByIdAndUpdate(userId, {
            firstLoginDiscountSent: true,
            firstLoginDiscountSentAt: new Date()
        });

        // Emit real-time notification via socket
        try {
            emitUserNotification(userId, {
                title,
                message,
                type: 'promotion',
                discountCode: discount.code,
                discountValue: discountValue,
                notificationId: notification._id,
                createdAt: notification.createdAt
            });
            console.log(`First-time discount notification sent to user ${userId}`);
        } catch (socketError) {
            console.error('Socket notification error:', socketError);
        }

        return {
            success: true,
            message: 'First-time discount notification sent successfully',
            discount: {
                code: discount.code,
                value: discountValue,
                type: discount.type
            }
        };
    } catch (error) {
        console.error('Error sending first-time discount notification:', error);
        return {
            success: false,
            message: 'Error sending notification',
            error: error.message
        };
    }
};

/**
 * Validate if discount can be used for first booking
 * Called during booking/checkout process
 */
const validateFirstTimeDiscount = async (userId, discountCode) => {
    try {
        const discount = await Discount.findOne({ 
            code: discountCode.toUpperCase() 
        });

        if (!discount) {
            return {
                valid: false,
                message: 'Invalid discount code'
            };
        }

        // Check if this is a first-time user discount
        const isFirstTimeDiscount = 
            discount.isFirstTimeUserDiscount ||
            /first.*user/i.test(discount.name) || 
            /welcome/i.test(discount.name) ||
            /first.*booking/i.test(discount.description);

        if (!isFirstTimeDiscount) {
            // Not a first-time discount, use regular validation
            return { valid: true };
        }

        // For first-time discounts, check if user has any bookings
        const bookingCount = await Booking.countDocuments({
            user: userId,
            status: { $in: ['Confirmed', 'CheckedIn', 'CheckedOut'] }
        });

        if (bookingCount > 0) {
            return {
                valid: false,
                message: 'This discount is only valid for first-time bookings'
            };
        }

        // Check if user has already used this discount
        const hasUsedDiscount = discount.usedBy.some(
            usage => usage.user.toString() === userId.toString()
        );

        if (hasUsedDiscount) {
            return {
                valid: false,
                message: 'You have already used this discount code'
            };
        }

        return { valid: true };
    } catch (error) {
        console.error('Error validating first-time discount:', error);
        return {
            valid: false,
            message: 'Error validating discount'
        };
    }
};

module.exports = {
    isEligibleForFirstTimeDiscount,
    findFirstTimeUserDiscount,
    sendFirstTimeDiscountNotification,
    validateFirstTimeDiscount
};
