const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a room name'],
        trim: true,
        maxlength: [100, 'Room name cannot be more than 100 characters']
    },
    type: {
        type: String,
        required: [true, 'Please add a room type'],
        enum: ['Standard', 'Deluxe', 'Suite'],
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
        maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    capacity: {
        adults: {
            type: Number,
            required: true,
            min: 1,
            max: 10
        },
        children: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        }
    },
    bedType: {
        type: String,
        required: true,
        enum: ['Single', 'Double', 'Queen', 'King', 'Twin']
    },
    area: {
        type: Number, // in square feet
        required: true,
        min: 100
    },
    price: {
        basePrice: {
            type: Number,
            required: [true, 'Please add a base price'],
            min: 0
        },
        seasonalPricing: [{
            season: {
                type: String,
                required: true
            },
            startDate: {
                type: Date,
                required: true
            },
            endDate: {
                type: Date,
                required: true
            },
            price: {
                type: Number,
                required: true,
                min: 0
            }
        }]
    },
    amenities: [{
        name: {
            type: String,
            required: true
        },
        icon: String,
        description: String
    }],
    features: {
        airConditioning: {
            type: Boolean,
            default: false
        },
        wifi: {
            type: Boolean,
            default: false
        },
        breakfast: {
            type: Boolean,
            default: false
        },
        television: {
            type: Boolean,
            default: false
        },
        miniBar: {
            type: Boolean,
            default: false
        },
        balcony: {
            type: Boolean,
            default: false
        },
        seaView: {
            type: Boolean,
            default: false
        },
        cityView: {
            type: Boolean,
            default: false
        },
        parkingIncluded: {
            type: Boolean,
            default: false
        }
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        altText: String,
        isPrimary: {
            type: Boolean,
            default: false
        }
    }],
    status: {
        type: String,
        enum: ['Available', 'Occupied', 'Maintenance', 'Out of Service'],
        default: 'Available'
    },
    lockedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null
    },
    lockExpiry: {
        type: Date,
        default: null
    },
    floor: {
        type: Number,
        required: true,
        min: 1
    },
    totalRooms: {
        type: Number,
        required: [true, 'Please specify total number of rooms'],
        min: 1,
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    maintenanceSchedule: [{
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        reason: String,
        notes: String
    }],
    averageRating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    bookingPolicy: {
        maxAdvanceBookingDays: {
            type: Number,
            default: 365
        },
        minBookingDays: {
            type: Number,
            default: 1
        },
        maxBookingDays: {
            type: Number,
            default: 30
        },
        cancellationPolicy: {
            type: String,
            default: 'Flexible'
        }
    }
}, {
    timestamps: true
});

// Indexes for better performance
RoomSchema.index({ type: 1 });
RoomSchema.index({ status: 1 });
RoomSchema.index({ 'price.basePrice': 1 });
RoomSchema.index({ isActive: 1 });

// Method to check if room is available for given dates
// requestedRooms: number of rooms desired for this room type (defaults to 1)
RoomSchema.methods.isAvailableForDates = async function (checkIn, checkOut, requestedRooms = 1) {
    // Basic validation
    if (!(checkIn instanceof Date)) checkIn = new Date(checkIn);
    if (!(checkOut instanceof Date)) checkOut = new Date(checkOut);

    // Normalize dates to day boundaries for consistent overlap checking
    checkIn.setHours(0, 0, 0, 0);
    checkOut.setHours(23, 59, 59, 999);

    // Check-out must be after check-in
    if (checkOut <= checkIn) return false;

    // Maintenance schedule conflict
    const isInMaintenance = this.maintenanceSchedule.some(maintenance => {
        return (checkIn < maintenance.endDate && checkOut > maintenance.startDate);
    });

    if (isInMaintenance) return false;

    // Room must be active and available generally
    if (!this.isActive || this.status !== 'Available') return false;

    // If concrete room numbers exist for this room type, prefer that single-source-of-truth
    const RoomNumber = mongoose.model('RoomNumber');
    const totalRoomNumbers = await RoomNumber.countDocuments({ roomType: this._id, isActive: true });

    if (totalRoomNumbers > 0) {
        const availableCount = await RoomNumber.getAvailableCount(this._id, checkIn, checkOut);
        return availableCount >= Number(requestedRooms);
    }

    // Fallback: aggregate overlapping bookings for this room type (no explicit room numbers)
    const Booking = mongoose.model('Booking');

    // Night-based booking overlap check
    // A room is NOT available if an existing booking overlaps with any night of the new booking.
    // Overlap condition: existingCheckInDate < newCheckOutDate AND existingCheckOutDate > newCheckInDate
    const overlapMatch = {
        status: { $in: ['Confirmed', 'CheckedIn'] },
        'bookingDates.checkInDate': { $lt: checkOut },     // existingCheckInDate < newCheckOutDate
        'bookingDates.checkOutDate': { $gt: checkIn },     // existingCheckOutDate > newCheckInDate
        'rooms.roomType': this._id
    };

    const agg = await Booking.aggregate([
        { $match: overlapMatch },
        { $project: { rooms: 1 } },
        { $unwind: '$rooms' },
        { $match: { 'rooms.roomType': this._id, 'rooms.status': { $ne: 'Cancelled' } } },
        { $group: { _id: null, bookedRooms: { $sum: 1 } } }
    ]);

    const bookedRooms = (agg[0] && agg[0].bookedRooms) ? agg[0].bookedRooms : 0;
    const availableRooms = (this.totalRooms || 0) - bookedRooms;

    return availableRooms >= Number(requestedRooms);
};

// Method to get price for specific dates
RoomSchema.methods.getPriceForDates = function (checkIn, checkOut) {
    let totalPrice = 0;
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < nights; i++) {
        const currentDate = new Date(checkIn);
        currentDate.setDate(checkIn.getDate() + i);

        let dailyPrice = this.price.basePrice;

        // Check for seasonal pricing
        const seasonalPrice = this.price.seasonalPricing.find(season =>
            currentDate >= season.startDate && currentDate <= season.endDate
        );

        if (seasonalPrice) {
            dailyPrice = seasonalPrice.price;
        }

        totalPrice += dailyPrice;
    }

    return totalPrice;
};

// Method to lock room for real-time booking
RoomSchema.methods.lockRoom = async function (userId, lockDurationMinutes = 5) {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);

    this.status = 'locked';
    this.lockedBy = userId;
    this.lockExpiry = lockExpiry;

    await this.save();
    return this;
};

// Method to unlock room
RoomSchema.methods.unlockRoom = async function () {
    this.status = 'Available';
    this.lockedBy = null;
    this.lockExpiry = null;

    await this.save();
    return this;
};

// Method to confirm room booking
RoomSchema.methods.confirmBooking = async function () {
    this.status = 'booked';
    this.lockedBy = null;
    this.lockExpiry = null;

    await this.save();
    return this;
};

// Method to check if lock is expired and release if needed
RoomSchema.methods.checkAndReleaseExpiredLock = async function () {
    if (this.status === 'locked' && this.lockExpiry && new Date() > this.lockExpiry) {
        await this.unlockRoom();
        return true; // Lock was released
    }
    return false; // Lock was not expired
};

// Static method to release all expired locks
RoomSchema.statics.releaseExpiredLocks = async function () {
    const now = new Date();
    const result = await this.updateMany(
        {
            status: 'locked',
            lockExpiry: { $lt: now }
        },
        {
            $set: {
                status: 'available',
                lockedBy: null,
                lockExpiry: null
            }
        }
    );

    return result.modifiedCount;
};

// Update average rating
RoomSchema.methods.updateAverageRating = async function () {
    const Review = mongoose.model('Review');

    const stats = await Review.aggregate([
        { $match: { room: this._id, isApproved: true } },
        { $group: { _id: '$room', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    if (stats.length > 0) {
        this.averageRating = Math.round(stats[0].avgRating * 10) / 10;
        this.totalReviews = stats[0].count;
    } else {
        this.averageRating = 0;
        this.totalReviews = 0;
    }

    await this.save();
};

module.exports = mongoose.model('Room', RoomSchema);