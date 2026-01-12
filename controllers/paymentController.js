const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Create payment intent (Stripe/Razorpay)
// @route   POST /api/payments/create-intent
// @access  Private
const createPaymentIntent = async (req, res) => {
    try {
        const { bookingId, paymentMethod } = req.body;

        // Find booking
        const booking = await Booking.findById(bookingId).populate('user room');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if user owns this booking
        if (booking.user._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to pay for this booking'
            });
        }

        // Check if booking is already paid
        if (booking.paymentStatus === 'Paid') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already paid'
            });
        }

        let paymentIntent = null;
        let clientSecret = null;

        if (paymentMethod === 'stripe') {
            // Stripe payment intent
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            
            paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(booking.pricing.totalAmount * 100), // Convert to cents
                currency: 'usd',
                metadata: {
                    bookingId: booking._id.toString(),
                    userId: req.user.id
                }
            });
            
            clientSecret = paymentIntent.client_secret;
        } else if (paymentMethod === 'razorpay') {
            // Razorpay order
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET
            });

            const order = await razorpay.orders.create({
                amount: Math.round(booking.pricing.totalAmount * 100), // Convert to paise
                currency: 'INR',
                receipt: `booking_${booking._id}`,
                notes: {
                    bookingId: booking._id.toString(),
                    userId: req.user.id
                }
            });

            paymentIntent = order;
            clientSecret = order.id;
        }

        res.status(200).json({
            success: true,
            data: {
                clientSecret,
                amount: booking.pricing.totalAmount,
                currency: paymentMethod === 'stripe' ? 'usd' : 'inr',
                bookingId: booking._id,
                paymentMethod
            }
        });

    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private
const confirmPayment = async (req, res) => {
    try {
        const {
            bookingId,
            paymentMethod,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount
        } = req.body;

        // Find booking
        const booking = await Booking.findById(bookingId).populate('user room');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Find payment record
        const payment = await Payment.findOne({ booking: bookingId });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found'
            });
        }

        // Idempotency check: If payment already completed, return success
        if (payment.status === 'Completed' && booking.status === 'Confirmed') {
            return res.status(200).json({
                success: true,
                message: 'Payment already verified and booking confirmed',
                data: {
                    bookingId: booking._id,
                    paymentId: payment._id,
                    status: 'Confirmed'
                }
            });
        }

        // Verify Razorpay payment signature
        let paymentVerified = false;

        if (paymentMethod === 'razorpay') {
            const crypto = require('crypto');

            // Correct Razorpay signature verification
            const text = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(text)
                .digest('hex');

            if (razorpay_signature === expectedSignature) {
                paymentVerified = true;
            }
        }

        if (!paymentVerified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Update payment record
        payment.status = 'Completed';
        payment.transactionId = razorpay_payment_id;
        payment.gatewayTransactionId = razorpay_payment_id;
        payment.gatewayPaymentId = razorpay_payment_id;
        payment.gatewaySignature = razorpay_signature;
        payment.paymentDate = new Date();
        await payment.save();

        // Update booking
        booking.paymentStatus = 'Paid';
        booking.status = 'Confirmed';
        booking.paymentDetails.transactionId = razorpay_payment_id;
        booking.paymentDetails.paidAmount = amount;
        booking.paymentDetails.paymentDate = new Date();
        await booking.save();

        // Release room lock
        const Room = require('../models/Room');
        const room = await Room.findById(booking.room);
        if (room) {
            try {
                await room.unlockRoom();
            } catch (unlockError) {
                console.error('Room unlock error:', unlockError);
                // Continue even if unlock fails
            }
        }

        // Send confirmation email
        try {
            const checkIn = new Date(booking.bookingDates.checkInDate);
            const checkOut = new Date(booking.bookingDates.checkOutDate);
            const nights = booking.bookingDates.nights;

            const emailMessage = `
Dear ${booking.guestDetails.primaryGuest.name},

Great news! Your payment has been successfully processed and your booking is CONFIRMED!

BOOKING DETAILS:
- Booking ID: ${booking.bookingId}
- Status: CONFIRMED ✓
- Room: ${room.name} (${room.type})
- Check-in Date: ${checkIn.toDateString()}
- Check-out Date: ${checkOut.toDateString()}
- Number of Nights: ${nights}
- Total Guests: ${booking.guestDetails.totalAdults} Adult(s), ${booking.guestDetails.totalChildren} Child(ren)

PAYMENT INFORMATION:
- Total Amount: ₹${amount.toFixed(2)}
- Payment ID: ${razorpay_payment_id}
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
        } catch (emailError) {
            console.error('Email sending error:', emailError);
        }

        // Emit real-time notifications
        try {
            const { emitUserNotification } = require('../config/socket');
            emitUserNotification(booking.user._id.toString(), {
                title: "✅ Payment Successful!",
                message: `Your payment for booking ${booking.bookingId} has been confirmed`,
                type: "success",
                bookingId: booking.bookingId,
            });
        } catch (notificationError) {
            console.error("Notification emission error:", notificationError);
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified and booking confirmed',
            data: {
                bookingId: booking._id,
                paymentId: payment._id,
                status: 'Confirmed'
            }
        });

    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get user payments
// @route   GET /api/payments
// @access  Private
const getPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const payments = await Payment.find({ user: req.user.id })
            .populate('booking', 'bookingId room pricing.totalAmount')
            .populate('booking.room', 'name type')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Payment.countDocuments({ user: req.user.id });

        res.status(200).json({
            success: true,
            count: payments.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: payments
        });

    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate({
                path: 'booking',
                populate: {
                    path: 'room',
                    select: 'name type'
                }
            })
            .populate('user', 'name email');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Check if user owns this payment or is admin
        if (payment.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this payment'
            });
        }

        res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Process refund (Admin only)
// @route   POST /api/payments/:id/refund
// @access  Private/Admin
const processRefund = async (req, res) => {
    try {
        const { amount, reason } = req.body;
        
        const payment = await Payment.findById(req.params.id)
            .populate('booking');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        if (payment.status === 'Refunded') {
            return res.status(400).json({
                success: false,
                message: 'Payment already refunded'
            });
        }

        // Process refund based on gateway
        let refundSuccess = false;
        let refundId = null;

        if (payment.gateway === 'stripe') {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const refund = await stripe.refunds.create({
                payment_intent: payment.transactionId,
                amount: Math.round(amount * 100)
            });
            
            if (refund.status === 'succeeded') {
                refundSuccess = true;
                refundId = refund.id;
            }
        } else if (payment.gateway === 'razorpay') {
            // Razorpay refund logic
            const Razorpay = require('razorpay');
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET
            });

            const refund = await razorpay.payments.refund(payment.transactionId, {
                amount: Math.round(amount * 100)
            });

            if (refund.status === 'processed') {
                refundSuccess = true;
                refundId = refund.id;
            }
        }

        if (!refundSuccess) {
            return res.status(400).json({
                success: false,
                message: 'Refund processing failed'
            });
        }

        // Update payment
        payment.status = 'Refunded';
        payment.refund = {
            amount,
            reason,
            refundId,
            processedBy: req.user.id,
            processedAt: new Date()
        };
        await payment.save();

        // Update booking
        payment.booking.paymentDetails.refundAmount = amount;
        payment.booking.paymentDetails.refundDate = new Date();
        payment.booking.paymentDetails.refundReason = reason;
        await payment.booking.save();

        res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {
        console.error('Process refund error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Generate invoice
// @route   GET /api/payments/:id/invoice
// @access  Private
const generateInvoice = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate({
                path: 'booking',
                populate: [
                    { path: 'room', select: 'name type' },
                    { path: 'user', select: 'name email phone address' }
                ]
            });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Check authorization
        if (payment.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this invoice'
            });
        }

        // Generate invoice data
        const invoiceData = {
            invoiceNumber: `INV-${payment._id.toString().slice(-8).toUpperCase()}`,
            invoiceDate: payment.createdAt,
            booking: payment.booking,
            payment: payment,
            customer: payment.booking.user,
            items: [
                {
                    description: `Room booking - ${payment.booking.room.name}`,
                    quantity: payment.booking.bookingDates.nights,
                    price: payment.booking.pricing.roomPrice / payment.booking.bookingDates.nights,
                    total: payment.booking.pricing.roomPrice
                }
            ]
        };

        // Add extra services to items
        if (payment.booking.pricing.extraServices.length > 0) {
            payment.booking.pricing.extraServices.forEach(service => {
                invoiceData.items.push({
                    description: service.service,
                    quantity: service.quantity,
                    price: service.price,
                    total: service.price * service.quantity
                });
            });
        }

        res.status(200).json({
            success: true,
            data: invoiceData
        });

    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create payment record (for cash/online payments)
// @route   POST /api/payments/create
// @access  Private
const createPayment = async (req, res) => {
    try {
        const { bookingId, paymentMethod, amount } = req.body;

        // Find booking
        const booking = await Booking.findById(bookingId).populate('user room');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if user owns this booking or is admin
        if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to create payment for this booking'
            });
        }

        // Check if payment already exists
        const existingPayment = await Payment.findOne({ booking: bookingId });
        if (existingPayment) {
            return res.status(400).json({
                success: false,
                message: 'Payment already exists for this booking'
            });
        }

        // Create payment record
        // Normalize payment method to handle case variations
        const normalizedPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod.trim() : paymentMethod;
        const isCashPayment = normalizedPaymentMethod === "Cash" || normalizedPaymentMethod === "cash" || normalizedPaymentMethod === "COD";
        
        const paymentData = {
            booking: bookingId,
            user: booking.user._id,
            amount: amount || booking.pricing.totalAmount,
            paymentMethod: normalizedPaymentMethod,
            gateway: 'Manual',
            status: 'Completed',
            transactionId: `TXN${Date.now()}`
        };

        const payment = await Payment.create(paymentData);

        // Update booking status - all payments are marked as paid
        booking.paymentStatus = 'Paid';
        booking.status = 'Confirmed';
        
        booking.paymentDetails = {
            method: normalizedPaymentMethod,
            paidAmount: amount || booking.pricing.totalAmount,
            paymentDate: new Date()
        };
        await booking.save();

        res.status(201).json({
            success: true,
            data: payment
        });

    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get all payments (Admin only)
// @route   GET /api/payments/admin/all
// @access  Private/Admin
const getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentMethod } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        let query = {};
        if (status) query.status = status;
        if (paymentMethod) query.paymentMethod = paymentMethod;

        const payments = await Payment.find(query)
            .populate('booking', 'bookingId room pricing.totalAmount')
            .populate('booking.room', 'name type')
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Payment.countDocuments(query);

        res.status(200).json({
            success: true,
            count: payments.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: payments
        });

    } catch (error) {
        console.error('Get all payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    createPaymentIntent,
    confirmPayment,
    createPayment,
    getPayments,
    getPayment,
    getAllPayments,
    processRefund,
    generateInvoice
};