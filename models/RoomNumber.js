const mongoose = require('mongoose');

const RoomNumberSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: [true, 'Please add a room number'],
        trim: true,
        maxlength: [20, 'Room number cannot be more than 20 characters']
    },
    roomType: {
        type: mongoose.Schema.ObjectId,
        ref: 'Room',
        required: [true, 'Room number must belong to a room type']
    },
    floor: {
        type: Number,
        required: [true, 'Please add a floor number'],
        min: 1
    },
    status: {
        type: String,
        enum: ['Available', 'Allocated', 'Occupied', 'Maintenance', 'Out of Service'],
        default: 'Available'
    },
    currentAllocation: {
        booking: {
            type: mongoose.Schema.ObjectId,
            ref: 'Booking',
            default: null
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            default: null
        },
        customerName: {
            type: String,
            default: null
        },
        checkInDate: {
            type: Date,
            default: null
        },
        checkOutDate: {
            type: Date,
            default: null
        },
        allocatedAt: {
            type: Date,
            default: null
        }
    },
    allocationHistory: [{
        booking: {
            type: mongoose.Schema.ObjectId,
            ref: 'Booking'
        },
        customer: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        customerName: String,
        checkInDate: Date,
        checkOutDate: Date,
        allocatedAt: Date,
        deallocatedAt: Date,
        actualCheckInTime: Date,
        actualCheckOutTime: Date
    }],
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
        notes: String,
        scheduledBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for better performance
RoomNumberSchema.index({ roomNumber: 1 });
RoomNumberSchema.index({ roomType: 1 });
RoomNumberSchema.index({ status: 1 });
RoomNumberSchema.index({ floor: 1 });
RoomNumberSchema.index({ 'currentAllocation.checkInDate': 1 });
RoomNumberSchema.index({ 'currentAllocation.checkOutDate': 1 });
RoomNumberSchema.index({ 'currentAllocation.customer': 1 });
RoomNumberSchema.index({ roomNumber: 1, roomType: 1 }, { unique: true });

// Method to check if room is available for given dates
RoomNumberSchema.methods.isAvailableForDates = async function (checkIn, checkOut) {
    // Normalize dates to day boundaries for consistent overlap checking
    const normalizedCheckIn = new Date(checkIn);
    normalizedCheckIn.setHours(0, 0, 0, 0);
    const normalizedCheckOut = new Date(checkOut);
    normalizedCheckOut.setHours(23, 59, 59, 999);

    // Check strict manual status
    if (this.status === 'Maintenance' || this.status === 'Out of Service') {
        return false;
    }

    // Check if room is in maintenance during the requested dates
    const isInMaintenance = this.maintenanceSchedule.some(maintenance => {
        return (normalizedCheckIn <= maintenance.endDate && normalizedCheckOut >= maintenance.startDate);
    });

    if (isInMaintenance) return false;

    // Check availability in RoomAllocation (Single Source of Truth)
    const RoomAllocation = mongoose.model('RoomAllocation');

    // Rough overlap query to narrow candidates
    const potentialConflicts = await RoomAllocation.find({
        roomNumber: this._id,
        status: 'Active',
        checkInDate: { $lt: normalizedCheckOut },   // existing start before requested end
        checkOutDate: { $gt: normalizedCheckIn }    // existing end after requested start
    });

    // Examine each allocation and ignore those where the existing checkout day exactly matches the new check-in day
    for (const alloc of potentialConflicts) {
        const allocCheckoutDay = new Date(alloc.checkOutDate);
        allocCheckoutDay.setHours(0, 0, 0, 0);
        if (allocCheckoutDay.getTime() === normalizedCheckIn.getTime()) {
            // same-day turnover is allowed
            continue;
        }
        // any other allocation constitutes a conflict
        return false;
    }

    return this.isActive;
};

// Method to allocate room to a booking
RoomNumberSchema.methods.allocate = async function (bookingId, customerId, customerName, checkInDate, checkOutDate) {
    this.status = 'Allocated';
    this.currentAllocation = {
        booking: bookingId,
        customer: customerId,
        customerName: customerName,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        allocatedAt: new Date()
    };

    await this.save();
    return this;
};

// Method to deallocate room (after checkout)
RoomNumberSchema.methods.deallocate = async function () {
    // Move current allocation to history
    if (this.currentAllocation && this.currentAllocation.booking) {
        this.allocationHistory.push({
            ...this.currentAllocation.toObject(),
            deallocatedAt: new Date()
        });
    }

    // Clear current allocation
    this.currentAllocation = {
        booking: null,
        customer: null,
        customerName: null,
        checkInDate: null,
        checkOutDate: null,
        allocatedAt: null
    };

    this.status = 'Available';

    await this.save();
    return this;
};

// Method to mark room as occupied (check-in)
RoomNumberSchema.methods.markOccupied = async function (actualCheckInTime) {
    this.status = 'Occupied';

    // Update allocation history if exists
    if (this.currentAllocation && this.currentAllocation.booking) {
        const historyEntry = this.allocationHistory.find(
            h => h.booking && h.booking.toString() === this.currentAllocation.booking.toString()
        );
        if (historyEntry) {
            historyEntry.actualCheckInTime = actualCheckInTime || new Date();
        }
    }

    await this.save();
    return this;
};

// Static method to find available room for a room type and date range
RoomNumberSchema.statics.findAvailableRoom = async function (roomTypeId, checkInDate, checkOutDate) {
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(checkOutDate);
    checkOut.setHours(23, 59, 59, 999);

    // Find all active rooms of this type
    // We fetch ALL because filtering by availability needs async check against RoomAllocation
    const rooms = await this.find({
        roomType: roomTypeId,
        isActive: true
    });

    // Check each room
    for (const room of rooms) {
        if (await room.isAvailableForDates(checkIn, checkOut)) {
            return room;
        }
    }

    return null;
};

// Static method to get available room count for a room type and date range
RoomNumberSchema.statics.getAvailableCount = async function (roomTypeId, checkInDate, checkOutDate) {
    const checkIn = new Date(checkInDate);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(checkOutDate);
    checkOut.setHours(23, 59, 59, 999);

    const rooms = await this.find({
        roomType: roomTypeId,
        isActive: true
    });

    let availableCount = 0;
    for (const room of rooms) {
        if (await room.isAvailableForDates(checkIn, checkOut)) {
            availableCount++;
        }
    }

    return availableCount;
};

// Validation: Check-out date must be after check-in date in maintenance schedule
RoomNumberSchema.pre('save', function (next) {
    if (this.maintenanceSchedule && this.maintenanceSchedule.length > 0) {
        for (const maintenance of this.maintenanceSchedule) {
            if (maintenance.endDate <= maintenance.startDate) {
                next(new Error('Maintenance end date must be after start date'));
                return;
            }
        }
    }
    next();
});

module.exports = mongoose.model('RoomNumber', RoomNumberSchema);
