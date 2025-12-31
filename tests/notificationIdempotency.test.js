/**
 * Notification Idempotency Tests
 * 
 * Tests to verify that notifications are created only once
 * and not duplicated on page reload or repeated calls
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
require('dotenv').config();

// Test configuration
const TEST_USER_ID = new mongoose.Types.ObjectId();
const TEST_BOOKING_ID = new mongoose.Types.ObjectId();
const TEST_ROOM_ID = new mongoose.Types.ObjectId();

const runTests = async () => {
    try {
        console.log('🧪 Starting Notification Idempotency Tests\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to test database\n');

        // Clean up test data
        await Notification.deleteMany({ userId: TEST_USER_ID });
        console.log('🧹 Cleaned up existing test data\n');

        // Test 1: Room Booking Notification Idempotency
        console.log('📝 Test 1: Room Booking Notification Idempotency');
        const booking1 = await Notification.createRoomBookingNotification({
            userId: TEST_USER_ID,
            title: 'Booking Confirmed',
            message: 'Your booking has been confirmed',
            bookingStatus: 'Confirmed',
            relatedRoomBookingId: TEST_BOOKING_ID,
            roomId: TEST_ROOM_ID
        });
        console.log('   ✅ First notification created:', booking1._id);

        // Try to create the same notification again
        const booking2 = await Notification.createRoomBookingNotification({
            userId: TEST_USER_ID,
            title: 'Booking Confirmed',
            message: 'Your booking has been confirmed',
            bookingStatus: 'Confirmed',
            relatedRoomBookingId: TEST_BOOKING_ID,
            roomId: TEST_ROOM_ID
        });
        console.log('   ✅ Second call returned existing:', booking2._id);

        if (booking1._id.toString() === booking2._id.toString()) {
            console.log('   ✅ PASS: Same notification returned (idempotent)\n');
        } else {
            console.log('   ❌ FAIL: Different notifications created (not idempotent)\n');
        }

        // Test 2: Payment Notification Idempotency
        console.log('📝 Test 2: Payment Notification Idempotency');
        const payment1 = await Notification.createPaymentNotification({
            userId: TEST_USER_ID,
            title: 'Payment Successful',
            message: 'Your payment has been processed',
            relatedRoomBookingId: TEST_BOOKING_ID,
            roomId: TEST_ROOM_ID,
            paymentStatus: 'completed'
        });
        console.log('   ✅ First payment notification created:', payment1._id);

        const payment2 = await Notification.createPaymentNotification({
            userId: TEST_USER_ID,
            title: 'Payment Successful',
            message: 'Your payment has been processed',
            relatedRoomBookingId: TEST_BOOKING_ID,
            roomId: TEST_ROOM_ID,
            paymentStatus: 'completed'
        });
        console.log('   ✅ Second call returned existing:', payment2._id);

        if (payment1._id.toString() === payment2._id.toString()) {
            console.log('   ✅ PASS: Same payment notification returned (idempotent)\n');
        } else {
            console.log('   ❌ FAIL: Different payment notifications created (not idempotent)\n');
        }

        // Test 3: Different Status Creates New Notification
        console.log('📝 Test 3: Different Status Creates New Notification');
        const booking3 = await Notification.createRoomBookingNotification({
            userId: TEST_USER_ID,
            title: 'Booking Cancelled',
            message: 'Your booking has been cancelled',
            bookingStatus: 'Cancelled', // Different status
            relatedRoomBookingId: TEST_BOOKING_ID,
            roomId: TEST_ROOM_ID
        });
        console.log('   ✅ Cancelled notification created:', booking3._id);

        if (booking3._id.toString() !== booking1._id.toString()) {
            console.log('   ✅ PASS: Different status creates new notification\n');
        } else {
            console.log('   ❌ FAIL: Same notification returned for different status\n');
        }

        // Test 4: Promotion Notification Idempotency
        console.log('📝 Test 4: Promotion Notification Idempotency');
        const promo1 = await Notification.createPromotionNotification({
            userId: TEST_USER_ID,
            title: 'Special Offer',
            message: '50% off on your next booking',
            promotionId: 'PROMO123'
        });
        console.log('   ✅ First promotion notification created:', promo1._id);

        const promo2 = await Notification.createPromotionNotification({
            userId: TEST_USER_ID,
            title: 'Special Offer',
            message: '50% off on your next booking',
            promotionId: 'PROMO123'
        });
        console.log('   ✅ Second call returned existing:', promo2._id);

        if (promo1._id.toString() === promo2._id.toString()) {
            console.log('   ✅ PASS: Same promotion notification returned (idempotent)\n');
        } else {
            console.log('   ❌ FAIL: Different promotion notifications created (not idempotent)\n');
        }

        // Test 5: System Notification Idempotency
        console.log('📝 Test 5: System Notification Idempotency');
        const system1 = await Notification.createSystemNotification({
            userId: TEST_USER_ID,
            title: 'System Maintenance',
            message: 'Scheduled maintenance on Sunday',
            systemEventId: 'MAINT001'
        });
        console.log('   ✅ First system notification created:', system1._id);

        const system2 = await Notification.createSystemNotification({
            userId: TEST_USER_ID,
            title: 'System Maintenance',
            message: 'Scheduled maintenance on Sunday',
            systemEventId: 'MAINT001'
        });
        console.log('   ✅ Second call returned existing:', system2._id);

        if (system1._id.toString() === system2._id.toString()) {
            console.log('   ✅ PASS: Same system notification returned (idempotent)\n');
        } else {
            console.log('   ❌ FAIL: Different system notifications created (not idempotent)\n');
        }

        // Test 6: Count total notifications created
        console.log('📝 Test 6: Total Notifications Count');
        const totalCount = await Notification.countDocuments({ userId: TEST_USER_ID });
        console.log(`   Total notifications in database: ${totalCount}`);
        
        // Should be 5: 2 booking (confirmed + cancelled), 1 payment, 1 promotion, 1 system
        if (totalCount === 5) {
            console.log('   ✅ PASS: Correct number of unique notifications (5)\n');
        } else {
            console.log(`   ❌ FAIL: Expected 5 notifications, got ${totalCount}\n`);
        }

        // Clean up test data
        await Notification.deleteMany({ userId: TEST_USER_ID });
        console.log('🧹 Cleaned up test data\n');

        console.log('✅ All tests completed!\n');

    } catch (error) {
        console.error('❌ Test error:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
};

// Run tests
runTests();
