const cron = require('node-cron');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Room = require('../models/Room');

// Auto-cancel expired bookings
// Runs every 5 minutes to find and cancel bookings that are pending payment for more than 15 minutes
const startBookingCleanupJob = () => {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('[CRON] Running booking cleanup job...');

            // Find bookings created more than 15 minutes ago with status PENDING
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            const expiredBookings = await Booking.find({
                status: 'Pending',
                paymentStatus: 'Pending',
                createdAt: { $lt: fifteenMinutesAgo }
            });

            if (expiredBookings.length === 0) {
                console.log('[CRON] No expired bookings found');
                return;
            }

            console.log(`[CRON] Found ${expiredBookings.length} expired booking(s) to cancel`);

            for (const booking of expiredBookings) {
                try {
                    // Cancel booking
                    booking.status = 'Cancelled';
                    booking.cancellationDetails = {
                        cancellationDate: new Date(),
                        cancelledBy: null, // System cancelled
                        reason: 'Payment timeout - booking expired after 15 minutes',
                        refundEligible: false,
                        cancellationFee: 0
                    };
                    await booking.save();

                    // Update payment as failed
                    await Payment.updateOne(
                        { booking: booking._id },
                        {
                            status: 'Failed',
                            metadata: {
                                ...this.metadata,
                                failureReason: 'Payment timeout'
                            }
                        }
                    );

                    // Release room lock using existing method
                    const room = await Room.findById(booking.room);
                    if (room) {
                        try {
                            await room.unlockRoom();
                            console.log(`[CRON] Released room lock for booking ${booking.bookingId}`);
                        } catch (unlockError) {
                            console.error(`[CRON] Failed to unlock room for booking ${booking.bookingId}:`, unlockError.message);
                        }
                    }

                    console.log(`[CRON] Auto-cancelled expired booking: ${booking.bookingId}`);
                } catch (bookingError) {
                    console.error(`[CRON] Error processing booking ${booking.bookingId}:`, bookingError.message);
                    // Continue with next booking even if this one fails
                }
            }

            console.log(`[CRON] Booking cleanup job completed. Cancelled ${expiredBookings.length} booking(s)`);
        } catch (error) {
            console.error('[CRON] Booking cleanup job error:', error.message);
            console.error('[CRON] Stack trace:', error.stack);
        }
    });

    console.log('✅ Booking cleanup cron job scheduled (runs every 5 minutes)');
};

module.exports = { startBookingCleanupJob };
