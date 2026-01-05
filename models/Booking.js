const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Booking must belong to a user']
    },
    room: {
        type: mongoose.Schema.ObjectId,
        ref: 'Room',
        required: [true, 'Booking must be for a room']
    },
    guestDetails: {
        primaryGuest: {
            name: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true
            },
            phone: {
                type: String,
                required: true
            }
        },
        additionalGuests: [{
            name: {
                type: String,
                required: true
            },
            age: Number,
            relation: String
        }],
        totalAdults: {
            type: Number,
            required: true,
            min: 1
        },
        totalChildren: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    bookingDates: {
        checkInDate: {
            type: Date,
            required: [true, 'Check-in date is required']
        },
        checkOutDate: {
            type: Date,
            required: [true, 'Check-out date is required']
        },
        nights: {
            type: Number,
            required: true,
            min: 1
        }
    },
    pricing: {
        roomPrice: {
            type: Number,
            required: true
        },
        extraServices: [{
            service: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            quantity: {
                type: Number,
                default: 1
            }
        }],
        subtotal: {
            type: Number,
            required: true
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
        discount: {
            couponCode: String,
            amount: {
                type: Number,
                default: 0
            },
            percentage: {
                type: Number,
                default: 0
            }
        },
        redemption: {
            redemptionCode: String,
            rewardName: String,
            amount: {
                type: Number,
                default: 0
            },
            discountType: {
                type: String,
                enum: ['percentage', 'fixed', 'freeItem']
            }
        },
        totalAmount: {
            type: Number,
            required: true
        }
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'NoShow'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'PartiallyPaid', 'Refunded', 'Failed'],
        default: 'Pending'
    },
    paymentDetails: {
        paymentId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Payment'
        },
        method: {
            type: String,
            enum: ['CreditCard', 'DebitCard', 'UPI', 'PayPal', 'Cash', 'BankTransfer', 'Card', 'Online']
        },
        transactionId: String,
        paidAmount: {
            type: Number,
            default: 0
        },
        paymentDate: Date,
        refundAmount: {
            type: Number,
            default: 0
        },
        refundDate: Date,
        refundReason: String
    },
    specialRequests: {
        type: String,
        maxlength: [500, 'Special requests cannot exceed 500 characters']
    },
    preferences: {
        earlyCheckIn: Boolean,
        lateCheckOut: Boolean,
        smoking: Boolean,
        floorPreference: Number,
        bedPreference: String,
        dietaryRequirements: String
    },
    checkInDetails: {
        actualCheckInTime: Date,
        frontDeskStaff: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        identityProof: {
            type: String,
            number: String
        },
        notes: String
    },
    checkOutDetails: {
        actualCheckOutTime: Date,
        frontDeskStaff: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        roomCondition: String,
        additionalCharges: [{
            description: String,
            amount: Number
        }],
        notes: String
    },
    cancellationDetails: {
        cancellationDate: Date,
        cancelledBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        reason: String,
        refundEligible: {
            type: Boolean,
            default: false
        },
        cancellationFee: {
            type: Number,
            default: 0
        }
    },
    reviews: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Review'
    }],
    invoice: {
        invoiceNumber: String,
        invoiceDate: Date,
        invoiceUrl: String
    }
}, {
    timestamps: true
});

// Indexes
BookingSchema.index({ user: 1 });
BookingSchema.index({ room: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ paymentStatus: 1 });
BookingSchema.index({ 'bookingDates.checkInDate': 1 });
BookingSchema.index({ 'bookingDates.checkOutDate': 1 });

// Generate booking ID before saving
BookingSchema.pre('save', function(next) {
    if (!this.bookingId) {
        const timestamp = Date.now().toString(36);
        const randomString = Math.random().toString(36).substr(2, 5);
        this.bookingId = `BK${timestamp}${randomString}`.toUpperCase();
    }
    
    // Calculate nights
    const checkIn = new Date(this.bookingDates.checkInDate);
    const checkOut = new Date(this.bookingDates.checkOutDate);
    this.bookingDates.nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    next();
});

// Validation: Check-out date must be after check-in date
BookingSchema.pre('save', function(next) {
    if (this.bookingDates.checkOutDate <= this.bookingDates.checkInDate) {
        next(new Error('Check-out date must be after check-in date'));
    }
    next();
});

// Method to calculate total amount
BookingSchema.methods.calculateTotalAmount = function() {
    let subtotal = this.pricing.roomPrice;
    
    // Add extra services
    this.pricing.extraServices.forEach(service => {
        subtotal += service.price * service.quantity;
    });
    
    this.pricing.subtotal = subtotal;
    
    // Calculate taxes
    const taxAmount = this.pricing.taxes.gst + this.pricing.taxes.serviceTax + this.pricing.taxes.other;
    
    // Apply discount
    let discountAmount = this.pricing.discount.amount;
    if (this.pricing.discount.percentage > 0) {
        discountAmount = (subtotal * this.pricing.discount.percentage) / 100;
    }
    
    this.pricing.totalAmount = subtotal + taxAmount - discountAmount;
    
    return this.pricing.totalAmount;
};

// Method to check if booking can be cancelled
BookingSchema.methods.canBeCancelled = function() {
    const now = new Date();
    const checkInDate = new Date(this.bookingDates.checkInDate);
    const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
    
    // More flexible cancellation policy:
    // - Can cancel if more than 2 hours before check-in and status is Pending or Confirmed
    // - Always allow cancellation for Pending bookings regardless of time
    if (this.status === 'Pending') {
        return true;
    }
    
    // For Confirmed bookings, allow cancellation up to 2 hours before check-in
    return hoursUntilCheckIn > 2 && ['Confirmed'].includes(this.status);
};

// Method to calculate cancellation fee
BookingSchema.methods.calculateCancellationFee = function() {
    const now = new Date();
    const checkInDate = new Date(this.bookingDates.checkInDate);
    const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
    
    let feePercentage = 0;
    
    // More flexible cancellation fee structure:
    if (hoursUntilCheckIn < 2) {
        feePercentage = 100; // No refund for last-minute cancellations
    } else if (hoursUntilCheckIn < 6) {
        feePercentage = 25; // 25% fee for cancellations within 6 hours
    } else if (hoursUntilCheckIn < 24) {
        feePercentage = 10; // 10% fee for cancellations within 24 hours
    }
    // else feePercentage = 0 (free cancellation for more than 24 hours)
    
    // No fee for Pending bookings
    if (this.status === 'Pending') {
        feePercentage = 0;
    }
    
    return (this.pricing.totalAmount * feePercentage) / 100;
};

// Static method to get booking statistics
BookingSchema.statics.getBookingStats = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalRevenue: { $sum: '$pricing.totalAmount' }
            }
        }
    ]);
};

module.exports = mongoose.model('Booking', BookingSchema);