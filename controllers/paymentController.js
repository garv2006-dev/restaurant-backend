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
            transactionId,
            paymentIntentId,
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

        // Verify payment based on method
        let paymentVerified = false;
        let paymentDetails = {};

        if (paymentMethod === 'stripe') {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status === 'succeeded') {
                paymentVerified = true;
                paymentDetails = {
                    method: 'CreditCard',
                    transactionId: paymentIntent.id,
                    paidAmount: amount,
                    paymentDate: new Date()
                };
            }
        } else if (paymentMethod === 'razorpay') {
            // Verify Razorpay payment signature
            const crypto = require('crypto');
            const razorpaySignature = req.headers['x-razorpay-signature'];

            const body = JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(body)
                .digest('hex');

            if (razorpaySignature === expectedSignature) {
                paymentVerified = true;
                paymentDetails = {
                    method: 'UPI',
                    transactionId,
                    paidAmount: amount,
                    paymentDate: new Date()
                };
            }
        }

        if (!paymentVerified) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Create payment record
        const payment = await Payment.create({
            booking: bookingId,
            user: booking.user._id,
            amount: amount,
            paymentMethod: paymentDetails.method,
            transactionId: paymentDetails.transactionId,
            gateway: paymentMethod,
            status: 'Completed'
        });

        // Update booking
        booking.paymentStatus = 'Paid';
        booking.status = 'Confirmed';
        booking.paymentDetails = paymentDetails;
        await booking.save();

        // Send confirmation email
        try {
            const emailMessage = `
                Dear ${booking.guestDetails.primaryGuest.name},
                
                Your payment has been successfully processed!
                
                Payment Details:
                - Booking ID: ${booking.bookingId}
                - Amount: $${amount.toFixed(2)}
                - Transaction ID: ${paymentDetails.transactionId}
                - Payment Date: ${paymentDetails.paymentDate.toDateString()}
                
                Your booking is now confirmed. We look forward to hosting you!
                
                Best regards,
                Hotel Booking Team
            `;

            await sendEmail({
                email: booking.guestDetails.primaryGuest.email,
                subject: `Payment Confirmation - ${booking.bookingId}`,
                message: emailMessage
            });
        } catch (emailError) {
            console.error('Email sending error:', emailError);
        }

        res.status(200).json({
            success: true,
            data: {
                payment,
                booking
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

// @desc    Create Razorpay order
// @route   POST /api/payments/razorpay/create-order
// @access  Private
const createRazorpayOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR', bookingDetails } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        // Check if Razorpay credentials are configured
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Razorpay credentials not configured'
            });
        }

        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const options = {
            amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
            currency: currency,
            receipt: `receipt_${Date.now()}`,
            notes: {
                userId: req.user.id,
                userName: req.user.name,
                userEmail: req.user.email,
                ...bookingDetails
            }
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID
            }
        });

    } catch (error) {
        console.error('Create Razorpay order error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create Razorpay order'
        });
    }
};

// @desc    Verify Razorpay payment
// @route   POST /api/payments/razorpay/verify
// @access  Private
const verifyRazorpayPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingData
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment verification parameters'
            });
        }

        // Verify payment signature
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed - Invalid signature'
            });
        }

        // Signature verified successfully
        // Fetch payment details from Razorpay to get the exact amount
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: paymentDetails.amount / 100, // Convert from paise to rupees
                currency: paymentDetails.currency,
                status: paymentDetails.status,
                method: paymentDetails.method,
                email: paymentDetails.email,
                contact: paymentDetails.contact
            }
        });

    } catch (error) {
        console.error('Verify Razorpay payment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Payment verification failed'
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
    generateInvoice,
    createRazorpayOrder,
    verifyRazorpayPayment
};