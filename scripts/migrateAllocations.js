const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const Booking = require('../models/Booking');
const RoomAllocation = require('../models/RoomAllocation');
require('../models/RoomNumber');
require('../models/Room');
require('../models/User');

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // Find bookings
        const bookings = await Booking.find({
            status: { $in: ['Confirmed', 'CheckedIn'] },
            roomNumber: { $exists: true, $ne: null }
        }).populate('user');

        console.log(`Found ${bookings.length} active bookings to migrate.`);

        let count = 0;
        for (const booking of bookings) {
            // Check if allocation exists
            const exists = await RoomAllocation.exists({ booking: booking._id });
            if (exists) {
                // console.log(`Allocation already exists for booking ${booking.bookingId}`);
                continue;
            }

            // Create Allocation
            try {
                await RoomAllocation.create({
                    booking: booking._id,
                    roomNumber: booking.roomNumber,
                    roomType: booking.room, // booking.room is ObjectId ref Room
                    guestName: booking.guestDetails?.primaryGuest?.name || booking.user?.name || 'Guest',
                    checkInDate: booking.bookingDates.checkInDate,
                    checkOutDate: booking.bookingDates.checkOutDate,
                    status: 'Active'
                });
                console.log(`Migrated booking ${booking.bookingId}`);
                count++;
            } catch (err) {
                console.error(`Failed to migrate booking ${booking.bookingId}:`, err.message);
            }
        }

        console.log(`Migration complete. Migrated ${count} bookings.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
};

migrate();
