const mongoose = require('mongoose');

const RoomAllocationSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.ObjectId,
        ref: 'Booking',
        required: [true, 'Allocation must reference a booking']
    },
    roomNumber: {
        type: mongoose.Schema.ObjectId,
        ref: 'RoomNumber',
        required: [true, 'Allocation must reference a room number']
    },
    roomType: {
        type: mongoose.Schema.ObjectId,
        ref: 'Room',
        required: [true, 'Allocation must reference a room type']
    },
    guestName: {
        type: String,
        required: true
    },
    checkInDate: {
        type: Date,
        required: true
    },
    checkOutDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Cancelled', 'Completed'],
        default: 'Active'
    }
}, {
    timestamps: true
});

// Indexes for fast lookup
RoomAllocationSchema.index({ roomNumber: 1, checkInDate: 1, checkOutDate: 1 });
RoomAllocationSchema.index({ booking: 1 });
RoomAllocationSchema.index({ status: 1 });

// Ensure check-out is after check-in
RoomAllocationSchema.pre('save', function (next) {
    if (this.checkOutDate <= this.checkInDate) {
        next(new Error('Check-out date must be after check-in date'));
    }
    next();
});

module.exports = mongoose.model('RoomAllocation', RoomAllocationSchema);
