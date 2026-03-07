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
    rooms: [{
        roomType: {
            type: mongoose.Schema.ObjectId,
            ref: 'Room',
            required: true
        },
        roomNumber: {
            type: mongoose.Schema.ObjectId,
            ref: 'RoomNumber',
            required: true
        },
        roomNumberInfo: {
            number: String,
            floor: Number
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Confirmed', 'Cancelled'],
            default: 'Confirmed'
        }
    }],
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
        enum: ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled', 'PartiallyCancelled', 'NoShow'],
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
            enum: ['CreditCard', 'DebitCard', 'UPI', 'PayPal', 'Cash', 'BankTransfer', 'Card', 'Online', 'Razorpay', 'netbanking', 'wallet', 'emi', 'cardless_emi', 'paylater']
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
BookingSchema.pre('save', function (next) {
    if (!this.bookingId) {
        const timestamp = Date.now().toString(36);
        const randomString = Math.random().toString(36).substr(2, 5);
        this.bookingId = `BK${timestamp}${randomString}`.toUpperCase();
    }

    // Calculate nights
    const checkIn = new Date(this.bookingDates.checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(this.bookingDates.checkOutDate);
    checkOut.setHours(0, 0, 0, 0);
    this.bookingDates.nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    next();
});

// Validation: Night-only booking constraints
BookingSchema.pre('save', function (next) {
    const { checkInDate, checkOutDate } = this.bookingDates;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Normalize to midnight for comparison
    checkIn.setHours(0, 0, 0, 0);
    checkOut.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check 1: Check-in date cannot be in the past — ONLY for new bookings.
    // Existing bookings (status updates, etc.) must not be blocked by this rule.
    if (this.isNew && checkIn < today) {
        return next(new Error('Check-in date cannot be in the past'));
    }

    // Check 2: Check-out date must be greater than check-in date (no same-day bookings)
    // Only validate when dates are actually being changed or on new bookings.
    const datesModified = this.isNew ||
        this.isModified('bookingDates.checkInDate') ||
        this.isModified('bookingDates.checkOutDate');

    if (datesModified) {
        if (checkOut <= checkIn) {
            return next(new Error('Same-day check-in and check-out is NOT allowed. Check-out date must be greater than check-in date'));
        }

        // Calculate and validate nights
        const checkInNights = new Date(checkIn);
        checkInNights.setHours(0, 0, 0, 0);
        const checkOutNights = new Date(checkOut);
        checkOutNights.setHours(0, 0, 0, 0);
        const nights = Math.round((checkOutNights - checkInNights) / (1000 * 60 * 60 * 24));
        if (nights < 1) {
            return next(new Error('Minimum 1 night required for booking'));
        }
    }

    next();
});

// Method to calculate total amount
BookingSchema.methods.calculateTotalAmount = function () {
    // Sum prices from all active rooms
    let roomPriceTotal = 0;
    this.rooms.forEach(room => {
        if (room.status !== 'Cancelled') {
            roomPriceTotal += room.price;
        }
    });

    this.pricing.roomPrice = roomPriceTotal;
    let subtotal = roomPriceTotal;

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
BookingSchema.methods.canBeCancelled = function () {
    const now = new Date();
    const checkInDate = new Date(this.bookingDates.checkInDate);
    const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);

    // More flexible cancellation policy:
    // - Can cancel if more than 2 hours before check-in and status is Pending or Confirmed
    // - Always allow cancellation for Pending bookings regardless of time
    if (this.status === 'Pending') {
        return true;
    }

    // Allow cancellation for Confirmed bookings regardless of time (fee logic handles the penalty)
    return ['Confirmed'].includes(this.status);
};

// Method to calculate cancellation fee
BookingSchema.methods.calculateCancellationFee = function () {
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
BookingSchema.statics.getBookingStats = async function (startDate, endDate) {
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