const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: [true, 'Please add a room number'],
        unique: true,
        trim: true
    },
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
        weekendPrice: {
            type: Number,
            required: true,
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
        enum: ['Available', 'Occupied', 'Maintenance', 'Out of Order'],
        default: 'Available'
    },
    floor: {
        type: Number,
        required: true,
        min: 1
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
RoomSchema.index({ roomNumber: 1 });

// Method to check if room is available for given dates
RoomSchema.methods.isAvailableForDates = async function(checkIn, checkOut) {
    const Booking = mongoose.model('Booking');
    
    // Check if room is in maintenance during the requested dates
    const isInMaintenance = this.maintenanceSchedule.some(maintenance => {
        return (checkIn <= maintenance.endDate && checkOut >= maintenance.startDate);
    });

    if (isInMaintenance) return false;

    // Check for existing bookings
    const conflictingBookings = await Booking.countDocuments({
        room: this._id,
        status: { $in: ['Confirmed', 'CheckedIn'] },
        $or: [
            {
                checkInDate: { $lte: checkOut },
                checkOutDate: { $gt: checkIn }
            }
        ]
    });

    return conflictingBookings === 0 && this.status === 'Available' && this.isActive;
};

// Method to get price for specific dates
RoomSchema.methods.getPriceForDates = function(checkIn, checkOut) {
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
        } else if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
            // Weekend pricing
            dailyPrice = this.price.weekendPrice;
        }
        
        totalPrice += dailyPrice;
    }
    
    return totalPrice;
};

// Update average rating
RoomSchema.methods.updateAverageRating = async function() {
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