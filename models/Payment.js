const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        unique: true,
        required: false // Will be auto-generated in pre-save hook
    },
    booking: {
        type: mongoose.Schema.ObjectId,
        ref: 'Booking',
        required: [true, 'Payment must belong to a booking']
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Payment must belong to a user']
    },
    amount: {
        type: Number,
        required: [true, 'Please specify payment amount'],
        min: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'INR',
        enum: ['INR', 'USD', 'EUR', 'GBP']
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['CreditCard', 'DebitCard', 'UPI', 'PayPal', 'Razorpay', 'Stripe', 'Cash', 'BankTransfer', 'Card', 'Online']
    },
    method: {
        type: String,
        enum: ['CreditCard', 'DebitCard', 'UPI', 'PayPal', 'Razorpay', 'Stripe', 'Cash', 'BankTransfer', 'Card', 'Online']
    },
    paymentGateway: {
        type: String,
        enum: ['Stripe', 'Razorpay', 'PayPal', 'Manual']
    },
    gatewayTransactionId: {
        type: String,
        required: function() {
            return this.paymentGateway !== 'Manual';
        }
    },
    transactionId: String, // Alias for gatewayTransactionId
    gatewayOrderId: String,
    gatewayPaymentId: String,
    gatewaySignature: String,
    gateway: {
        type: String,
        enum: ['Stripe', 'Razorpay', 'PayPal', 'Manual', 'Cash', 'Card', 'Online']
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Completed', 'Failed', 'Cancelled', 'Refunded', 'PartiallyRefunded'],
        default: 'Pending'
    },
    paymentDetails: {
        cardLast4: String,
        cardBrand: String,
        cardType: String,
        bankName: String,
        upiId: String,
        paypalEmail: String
    },
    billingAddress: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        address: {
            line1: String,
            line2: String,
            city: String,
            state: String,
            postalCode: String,
            country: String
        }
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    dueDate: Date,
    description: String,
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    refund: {
        isRefunded: {
            type: Boolean,
            default: false
        },
        refundAmount: {
            type: Number,
            default: 0
        },
        refundDate: Date,
        refundReason: String,
        refundTransactionId: String,
        refundStatus: {
            type: String,
            enum: ['Pending', 'Processing', 'Completed', 'Failed'],
            default: 'Pending'
        },
        refundMethod: {
            type: String,
            enum: ['Original', 'BankTransfer', 'Cash']
        },
        refundedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        }
    },
    fees: {
        gatewayFee: {
            type: Number,
            default: 0
        },
        platformFee: {
            type: Number,
            default: 0
        },
        processingFee: {
            type: Number,
            default: 0
        }
    },
    taxes: {
        gst: {
            type: Number,
            default: 0
        },
        serviceTax: {
            type: Number,
            default: 0
        },
        other: {
            type: Number,
            default: 0
        }
    },
    receipt: {
        receiptNumber: String,
        receiptUrl: String,
        emailSent: {
            type: Boolean,
            default: false
        },
        emailSentAt: Date
    },
    webhookData: {
        type: mongoose.Schema.Types.Mixed
    },
    failureReason: String,
    retryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    nextRetryAt: Date,
    notes: String,
    internalNotes: String // Admin only notes
}, {
    timestamps: true
});

// Indexes
PaymentSchema.index({ booking: 1 });
PaymentSchema.index({ user: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ gatewayTransactionId: 1 });
PaymentSchema.index({ 'refund.isRefunded': 1 });

// Generate payment ID before saving
PaymentSchema.pre('save', function(next) {
    if (!this.paymentId) {
        const timestamp = Date.now().toString(36);
        const randomString = Math.random().toString(36).substr(2, 5);
        this.paymentId = `PAY${timestamp}${randomString}`.toUpperCase();
    }
    
    // Generate receipt number if payment is completed
    if (this.status === 'Completed' && !this.receipt.receiptNumber) {
        const receiptTimestamp = Date.now().toString(36);
        this.receipt.receiptNumber = `RCP${receiptTimestamp}`.toUpperCase();
    }
    
    next();
});

// Method to process refund
PaymentSchema.methods.processRefund = function(refundAmount, reason, refundedBy) {
    if (this.status !== 'Completed') {
        throw new Error('Can only refund completed payments');
    }
    
    if (refundAmount > this.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
    }
    
    this.refund.refundAmount = refundAmount;
    this.refund.refundReason = reason;
    this.refund.refundedBy = refundedBy;
    this.refund.refundDate = new Date();
    this.refund.isRefunded = true;
    this.refund.refundStatus = 'Processing';
    
    // Update payment status
    if (refundAmount === this.amount) {
        this.status = 'Refunded';
    } else {
        this.status = 'PartiallyRefunded';
    }
    
    return this.save();
};

// Method to calculate net amount (after fees and taxes)
PaymentSchema.methods.getNetAmount = function() {
    const totalFees = this.fees.gatewayFee + this.fees.platformFee + this.fees.processingFee;
    const totalTaxes = this.taxes.gst + this.taxes.serviceTax + this.taxes.other;
    return this.amount - totalFees - totalTaxes;
};

// Method to check if payment can be refunded
PaymentSchema.methods.canBeRefunded = function() {
    return this.status === 'Completed' && !this.refund.isRefunded;
};

// Method to retry failed payment
PaymentSchema.methods.scheduleRetry = function() {
    if (this.retryCount >= this.maxRetries) {
        throw new Error('Maximum retry attempts reached');
    }
    
    this.retryCount += 1;
    
    // Schedule next retry (exponential backoff)
    const backoffMinutes = Math.pow(2, this.retryCount) * 5; // 5, 10, 20 minutes
    this.nextRetryAt = new Date(Date.now() + (backoffMinutes * 60 * 1000));
    
    return this.save();
};

// Static method to get payment statistics
PaymentSchema.statics.getPaymentStats = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                paymentDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                averageAmount: { $avg: '$amount' }
            }
        }
    ]);
};

// Static method to get daily revenue
PaymentSchema.statics.getDailyRevenue = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                status: 'Completed',
                paymentDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$paymentDate' },
                    month: { $month: '$paymentDate' },
                    day: { $dayOfMonth: '$paymentDate' }
                },
                totalRevenue: { $sum: '$amount' },
                transactionCount: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);
};

// Static method to get payment method distribution
PaymentSchema.statics.getPaymentMethodStats = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                status: 'Completed',
                paymentDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: '$paymentMethod',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                percentage: {
                    $multiply: [
                        { $divide: ['$count', { $sum: '$count' }] },
                        100
                    ]
                }
            }
        }
    ]);
};

module.exports = mongoose.model('Payment', PaymentSchema);