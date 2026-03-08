const cron = require('node-cron');
const Booking = require('../models/Booking');
const RoomNumber = require('../models/RoomNumber');
const RoomAllocation = require('../models/RoomAllocation');
const sendEmail = require('./sendEmail');
const { generateCancellationEmail } = require('./emailTemplates');
const {
    emitBookingStatusChange,
    emitUserNotification
} = require('../config/socket');
const { createRoomBookingNotification } = require('../controllers/notificationController');

/**
 * Auto-cancel bookings where:
 * - Status is "Confirmed" or "Pending" (user has NOT checked in)
 * - The check-in date has PASSED (is in the past)
 * 
 * Bookings with status "CheckedIn" are NEVER auto-cancelled because the guest
 * has already arrived.
 */
const autoCancelExpiredBookings = async () => {
    try {
        const now = new Date();
        // Normalize to start of today (midnight)
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        console.log(`\n🔄 [Auto-Cancel] Running auto-cancel check at ${now.toISOString()}`);

        // Find all bookings that are Confirmed or Pending AND check-out date is in the past
        // These are bookings that have effectively expired as their stay period is over
        const expiredBookings = await Booking.find({
            status: { $in: ['Confirmed', 'Pending'] },
            'bookingDates.checkOutDate': { $lt: today } // Check-out date is before today
        }).populate('rooms.roomType').populate('user');

        if (expiredBookings.length === 0) {
            console.log('✅ [Auto-Cancel] No expired bookings found.');
            return { cancelled: 0 };
        }

        console.log(`⚠️  [Auto-Cancel] Found ${expiredBookings.length} expired booking(s) to cancel.`);

        let cancelledCount = 0;

        for (const booking of expiredBookings) {
            try {
                console.log(`  📋 Cancelling booking ${booking.bookingId} (Status: ${booking.status}, Check-out: ${booking.bookingDates.checkOutDate.toISOString()})`);

                const previousStatus = booking.status;

                // Update booking status to Cancelled
                booking.status = 'Cancelled';
                booking.cancellationDetails = {
                    cancellationDate: new Date(),
                    cancelledBy: null, // System-initiated cancellation (no user)
                    reason: `Auto-cancelled: Stay period ended on ${booking.bookingDates.checkOutDate.toDateString()} but guest never checked in. Booking was in "${previousStatus}" status.`,
                    refundEligible: false,
                    cancellationFee: booking.pricing.totalAmount // Full amount as no-show fee
                };

                // Mark all rooms as Cancelled
                booking.rooms.forEach(room => {
                    room.status = 'Cancelled';
                });

                // Deallocate all room numbers
                for (const roomItem of booking.rooms) {
                    if (roomItem.roomNumber) {
                        try {
                            const roomNumberDoc = await RoomNumber.findById(roomItem.roomNumber);
                            if (roomNumberDoc) {
                                await roomNumberDoc.deallocate();
                                console.log(`    🛏️  Room ${roomNumberDoc.roomNumber} deallocated`);
                            }

                            // Cancel the RoomAllocation record
                            await RoomAllocation.findOneAndUpdate(
                                { booking: booking._id, roomNumber: roomItem.roomNumber, status: 'Active' },
                                { status: 'Cancelled' }
                            );
                        } catch (roomError) {
                            console.error(`    ❌ Error deallocating room ${roomItem.roomNumber}:`, roomError.message);
                        }
                    }
                }

                // Safety net: cancel ALL remaining Active allocations for this booking
                await RoomAllocation.updateMany(
                    { booking: booking._id, status: 'Active' },
                    { status: 'Cancelled' }
                );

                await booking.save();
                cancelledCount++;

                console.log(`    ✅ Booking ${booking.bookingId} auto-cancelled successfully`);

                // Send cancellation email to the guest (same template, different refund based on payment)
                try {
                    const paymentMethod = booking.paymentDetails?.method || '';
                    const isCashPayment = paymentMethod.toLowerCase() === 'cash';

                    // Online payment = full refund, Cash payment = no refund
                    const cancellationFee = isCashPayment ? booking.pricing.totalAmount : 0;
                    const refundAmount = isCashPayment ? 0 : booking.pricing.totalAmount;

                    const htmlMessage = generateCancellationEmail(booking, cancellationFee, refundAmount);

                    await sendEmail({
                        email: booking.guestDetails.primaryGuest.email,
                        subject: `❌ Booking Cancelled - ${booking.bookingId} | Luxury Hotel`,
                        message: `Your booking ${booking.bookingId} has been cancelled.`,
                        html: htmlMessage,
                    });
                    console.log(`    📧 Cancellation email sent to ${booking.guestDetails.primaryGuest.email} (${isCashPayment ? 'Cash' : 'Online'} payment)`);
                } catch (emailError) {
                    console.error(`    ❌ Email sending error for ${booking.bookingId}:`, emailError.message);
                }

                // Emit real-time notification
                try {
                    const userId = booking.user?._id
                        ? booking.user._id.toString()
                        : booking.user?.toString();

                    if (userId) {
                        emitBookingStatusChange(booking.bookingId, 'Cancelled', userId);

                        const mainRoomType = booking.rooms[0]?.roomType;
                        if (mainRoomType && typeof createRoomBookingNotification === 'function') {
                            await createRoomBookingNotification(
                                userId,
                                { booking, room: mainRoomType, rooms: booking.rooms, status: 'Cancelled' },
                                'auto_cancelled'
                            );
                        }
                    }
                } catch (notificationError) {
                    console.error(`    ❌ Notification error for ${booking.bookingId}:`, notificationError.message);
                }

            } catch (bookingError) {
                console.error(`  ❌ Error cancelling booking ${booking.bookingId}:`, bookingError.message);
            }
        }

        console.log(`🏁 [Auto-Cancel] Completed. ${cancelledCount}/${expiredBookings.length} booking(s) cancelled.\n`);
        return { cancelled: cancelledCount, total: expiredBookings.length };

    } catch (error) {
        console.error('❌ [Auto-Cancel] Critical error:', error.message);
        return { cancelled: 0, error: error.message };
    }
};

/**
 * Start the auto-cancel cron job.
 * 
 * Schedule: Runs every hour at minute 0 (e.g., 12:00, 13:00, 14:00...)
 * This ensures expired bookings are caught within an hour of the date changing.
 * 
 * Also runs immediately once on server start to catch any missed bookings.
 */
const startAutoCancelScheduler = () => {
    // Run every hour at the top of the hour
    const task = cron.schedule('0 * * * *', async () => {
        console.log('⏰ [Scheduler] Auto-cancel cron job triggered');
        await autoCancelExpiredBookings();
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata' // Adjust to your timezone
    });

    console.log('✅ [Scheduler] Auto-cancel cron job scheduled (runs every hour)');

    // Run immediately on server start to catch any bookings that expired while server was down
    setTimeout(async () => {
        console.log('🚀 [Scheduler] Running initial auto-cancel check on startup...');
        await autoCancelExpiredBookings();
    }, 5000); // Wait 5 seconds for DB connection to be ready

    return task;
};

module.exports = {
    autoCancelExpiredBookings,
    startAutoCancelScheduler
};
