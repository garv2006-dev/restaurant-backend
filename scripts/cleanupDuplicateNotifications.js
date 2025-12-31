/**
 * Cleanup Duplicate Notifications Script
 * 
 * This script removes duplicate notifications from the database
 * that may have been created before the idempotency fix was implemented.
 * 
 * Run with: node scripts/cleanupDuplicateNotifications.js
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config();

const cleanupDuplicateNotifications = async () => {
    try {
        console.log('🔍 Starting duplicate notification cleanup...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to database\n');

        // Find all notifications
        const allNotifications = await Notification.find({})
            .sort({ createdAt: 1 }); // Oldest first

        console.log(`📊 Total notifications found: ${allNotifications.length}\n`);

        // Track duplicates by type
        const duplicatesByType = {
            room_booking: 0,
            payment: 0,
            promotion: 0,
            system: 0
        };

        const notificationsToDelete = [];

        // Group notifications by unique key
        const notificationMap = new Map();

        for (const notification of allNotifications) {
            let uniqueKey;

            switch (notification.type) {
                case 'room_booking':
                    // Unique key: userId + bookingId + status
                    uniqueKey = `${notification.userId}_${notification.relatedRoomBookingId}_${notification.bookingStatus}`;
                    break;

                case 'payment':
                    // Unique key: userId + bookingId + title (to differentiate success/failure)
                    uniqueKey = `${notification.userId}_${notification.relatedRoomBookingId}_${notification.title}`;
                    break;

                case 'promotion':
                    // Unique key: userId + title + message
                    uniqueKey = `${notification.userId}_${notification.title}_${notification.message}`;
                    break;

                case 'system':
                    // Unique key: userId + title + message
                    uniqueKey = `${notification.userId}_${notification.title}_${notification.message}`;
                    break;

                default:
                    uniqueKey = `${notification.userId}_${notification.type}_${notification.createdAt}`;
            }

            if (notificationMap.has(uniqueKey)) {
                // Duplicate found - mark for deletion (keep the oldest one)
                notificationsToDelete.push(notification._id);
                duplicatesByType[notification.type]++;
                console.log(`🔴 Duplicate found: ${notification.type} - ${notification.title} (ID: ${notification._id})`);
            } else {
                // First occurrence - keep it
                notificationMap.set(uniqueKey, notification);
            }
        }

        console.log('\n📈 Duplicate Summary:');
        console.log(`   Room Booking: ${duplicatesByType.room_booking}`);
        console.log(`   Payment: ${duplicatesByType.payment}`);
        console.log(`   Promotion: ${duplicatesByType.promotion}`);
        console.log(`   System: ${duplicatesByType.system}`);
        console.log(`   Total Duplicates: ${notificationsToDelete.length}\n`);

        if (notificationsToDelete.length === 0) {
            console.log('✅ No duplicates found! Database is clean.\n');
        } else {
            // Delete duplicates
            console.log(`🗑️  Deleting ${notificationsToDelete.length} duplicate notifications...\n`);
            
            const deleteResult = await Notification.deleteMany({
                _id: { $in: notificationsToDelete }
            });

            console.log(`✅ Successfully deleted ${deleteResult.deletedCount} duplicate notifications\n`);
            
            // Verify cleanup
            const remainingCount = await Notification.countDocuments({});
            console.log(`📊 Remaining notifications: ${remainingCount}\n`);
        }

        console.log('✅ Cleanup completed successfully!\n');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
};

// Run the cleanup
cleanupDuplicateNotifications();
