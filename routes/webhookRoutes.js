const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const sendEmail = require('../utils/sendEmail');

// Razorpay Webhook Handler
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        // Step 1: Verify webhook signature
        const webhookSignature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('RAZORPAY_WEBHOOK_SECRET not configured');
            return res.status(500).json({
                success: false,
                message: 'Webhook secret not configured'
            });
        }

        // Calculate expected signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(req.body)
            .digest('hex');

        // Verify signature
        if (webhookSignature !== expectedSignature) {
            console.error('Webhook signature mismatch - potential security issue');
            return res.status(400).json({
                success: false,
                message: 'Invalid signature'
            });
        }

        // Step 2: Parse webhook event
        const event = JSON.parse(req.body.toString());
        const eventType = event.event;
        const paymentEntity = event.payload.payment.entity;

        console.log('Razorpay webhook received:', eventType);

        // Step 3: Handle payment.captured event
        if (eventType === 'payment.captured') {
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;
            const amount = paymentEntity.amount / 100; // Convert from paise to rupees
            const status = paymentEntity.status;

            // Find payment by gatewayOrderId
            const payment = await Payment.findOne({ gatewayOrderId: orderId });

            if (!payment) {
                console.warn(`Payment not found for order_id: ${orderId}`);
                return res.status(200).json({ success: true, message: 'Payment not found' });
            }

            // Idempotency check: If already processed, return success
            if (payment.status === 'Completed') {
                console.log(`Payment ${paymentId} already processed`);
                return res.status(200).json({ success: true, message: 'Already processed' });
            }

            // Find booking
            const booking = await Booking.findById(payment.booking).populate('room user');

            if (!booking) {
                console.warn(`Booking not found for payment: ${payment._id}`);
                return res.status(200).json({ success: true, message: 'Booking not found' });
            }

            // Check if booking already confirmed
            if (booking.status === 'Confirmed' && booking.paymentStatus === 'Paid') {
                console.log(`Booking ${booking.bookingId} already confirmed`);
                return res.status(200).json({ success: true, message: 'Booking already confirmed' });
            }

            // Update payment record
            payment.status = 'Completed';
            payment.transactionId = paymentId;
            payment.gatewayTransactionId = paymentId;
            payment.gatewayPaymentId = paymentId;
            payment.paymentDate = new Date();
            await payment.save();

            // Update booking
            booking.paymentStatus = 'Paid';
            booking.status = 'Confirmed';
            booking.paymentDetails.transactionId = paymentId;
            booking.paymentDetails.paidAmount = amount;
            booking.paymentDetails.paymentDate = new Date();
            await booking.save();

            // Release room lock
            if (booking.room) {
                try {
                    const room = await Room.findById(booking.room);
                    if (room) {
                        await room.unlockRoom();
                    }
                } catch (unlockError) {
                    console.error('Room unlock error:', unlockError);
                }
            }

            // Send confirmation email
            try {
                const checkIn = new Date(booking.bookingDates.checkInDate);
                const checkOut = new Date(booking.bookingDates.checkOutDate);
                const nights = booking.bookingDates.nights;
                const roomName = booking.room.name || 'Your Room';
                const roomType = booking.room.type || '';

                const emailMessage = `
Dear ${booking.guestDetails.primaryGuest.name},

Great news! Your payment has been successfully processed and your booking is CONFIRMED!

BOOKING DETAILS:
- Booking ID: ${booking.bookingId}
- Status: CONFIRMED ✓
- Room: ${roomName} (${roomType})
- Check-in Date: ${checkIn.toDateString()}
- Check-out Date: ${checkOut.toDateString()}
- Number of Nights: ${nights}
- Total Guests: ${booking.guestDetails.totalAdults} Adult(s), ${booking.guestDetails.totalChildren} Child(ren)

PAYMENT INFORMATION:
- Total Amount: ₹${amount.toFixed(2)}
- Payment ID: ${paymentId}
- Payment Status: Paid
- Payment Date: ${new Date().toDateString()}

We look forward to welcoming you at our hotel!

If you have any questions or need to make changes, please contact us at:
- Email: concierge@luxuryhotel.com
- Phone: +1 (555) 123-4567

Best regards,
Luxury Hotel Team
                `;

                await sendEmail({
                    email: booking.guestDetails.primaryGuest.email,
                    subject: `✅ Payment Confirmed - Booking ${booking.bookingId} | Luxury Hotel`,
                    message: emailMessage
                });

                console.log(`Confirmation email sent for booking ${booking.bookingId}`);
            } catch (emailError) {
                console.error('Confirmation email error:', emailError);
            }

            // Emit real-time notification
            try {
                const { emitUserNotification } = require('../config/socket');
                emitUserNotification(booking.user._id.toString(), {
                    title: "✅ Payment Successful!",
                    message: `Your payment for booking ${booking.bookingId} has been confirmed`,
                    type: "success",
                    bookingId: booking.bookingId,
                });
            } catch (notificationError) {
                console.error('Notification emission error:', notificationError);
            }

            console.log(`Webhook processed successfully for booking ${booking.bookingId}`);
            return res.status(200).json({ success: true, message: 'OK' });
        }

        // Step 4: Handle payment.failed event
        if (eventType === 'payment.failed') {
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;
            const errorDescription = paymentEntity.error_description || 'Payment failed';

            // Find payment by gatewayOrderId
            const payment = await Payment.findOne({ gatewayOrderId: orderId });

            if (!payment) {
                console.warn(`Payment not found for failed order_id: ${orderId}`);
                return res.status(200).json({ success: true, message: 'Payment not found' });
            }

            // Find booking
            const booking = await Booking.findById(payment.booking).populate('room user');

            if (!booking) {
                console.warn(`Booking not found for failed payment: ${payment._id}`);
                return res.status(200).json({ success: true, message: 'Booking not found' });
            }

            // Update payment status
            payment.status = 'Failed';
            payment.gatewayPaymentId = paymentId;
            await payment.save();

            // Update booking status
            booking.status = 'Cancelled';
            booking.paymentStatus = 'Failed';
            await booking.save();

            // Release room lock
            if (booking.room) {
                try {
                    const room = await Room.findById(booking.room);
                    if (room) {
                        await room.unlockRoom();
                    }
                } catch (unlockError) {
                    console.error('Room unlock error:', unlockError);
                }
            }

            // Send failure notification email
            try {
                const emailMessage = `
Dear ${booking.guestDetails.primaryGuest.name},

We're sorry to inform you that your payment for booking ${booking.bookingId} has failed.

Reason: ${errorDescription}

Your booking has been cancelled and the room lock has been released. You can try booking again if you wish.

If you have any questions or need assistance, please contact us at:
- Email: concierge@luxuryhotel.com
- Phone: +1 (555) 123-4567

Best regards,
Luxury Hotel Team
                `;

                await sendEmail({
                    email: booking.guestDetails.primaryGuest.email,
                    subject: `❌ Payment Failed - Booking ${booking.bookingId} | Luxury Hotel`,
                    message: emailMessage
                });

                console.log(`Failure notification email sent for booking ${booking.bookingId}`);
            } catch (emailError) {
                console.error('Failure notification email error:', emailError);
            }

            console.log(`Payment failed webhook processed for booking ${booking.bookingId}`);
            return res.status(200).json({ success: true, message: 'OK' });
        }

        // For other events, just acknowledge
        console.log(`Unhandled webhook event: ${eventType}`);
        return res.status(200).json({ success: true, message: 'Event acknowledged' });

    } catch (error) {
        console.error('Webhook processing error:', error);
        // Return 500 so Razorpay will retry
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;
