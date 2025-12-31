/**
 * Test Script: First-Time User Discount System
 * 
 * This script helps test the first-time discount notification system
 * by simulating the process for a specific user.
 * 
 * Usage:
 *   node backend/scripts/testFirstTimeDiscount.js <userEmail>
 * 
 * Example:
 *   node backend/scripts/testFirstTimeDiscount.js test@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Discount = require('../models/Discount');
const Notification = require('../models/Notification');
const {
    isEligibleForFirstTimeDiscount,
    findFirstTimeUserDiscount,
    sendFirstTimeDiscountNotification
} = require('../services/firstTimeUserService');

const testFirstTimeDiscount = async (userEmail) => {
    try {
        console.log('🧪 Testing First-Time Discount System');
        console.log('=====================================\n');
        
        // Connect to MongoDB
        console.log('📡 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected\n');
        
        // Find user
        console.log(`🔍 Looking for user: ${userEmail}`);
        const user = await User.findOne({ email: userEmail });
        
        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }
        
        console.log(`✅ Found user: ${user.name} (${user._id})`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   First Discount Sent: ${user.firstLoginDiscountSent || false}\n`);
        
        // Check bookings
        console.log('📋 Checking user bookings...');
        const bookings = await Booking.find({ user: user._id });
        const completedBookings = bookings.filter(b => 
            ['Confirmed', 'CheckedIn', 'CheckedOut'].includes(b.status)
        );
        
        console.log(`   Total bookings: ${bookings.length}`);
        console.log(`   Completed bookings: ${completedBookings.length}\n`);
        
        // Check eligibility
        console.log('🎯 Checking eligibility...');
        const isEligible = await isEligibleForFirstTimeDiscount(user._id);
        console.log(`   Eligible: ${isEligible ? '✅ YES' : '❌ NO'}\n`);
        
        if (!isEligible) {
            console.log('ℹ️  Reasons user might not be eligible:');
            if (user.firstLoginDiscountSent) {
                console.log('   - Already received first-time discount');
            }
            if (completedBookings.length > 0) {
                console.log('   - Has completed bookings');
            }
            const accountAge = Date.now() - new Date(user.createdAt).getTime();
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
            if (accountAge > thirtyDaysInMs) {
                console.log('   - Account is older than 30 days');
            }
            if (user.role !== 'customer') {
                console.log('   - User is not a customer');
            }
            console.log('');
        }
        
        // Find available discount
        console.log('🎁 Looking for first-time discount...');
        const discount = await findFirstTimeUserDiscount();
        
        if (!discount) {
            console.log('❌ No first-time discount found');
            console.log('\nℹ️  To create a first-time discount:');
            console.log('   1. Log in to Admin Dashboard');
            console.log('   2. Go to Discount Management');
            console.log('   3. Create a discount with:');
            console.log('      - Name containing "First User" or "Welcome"');
            console.log('      - Per-user usage limit: 1');
            console.log('      - Active status: true');
            process.exit(1);
        }
        
        console.log(`✅ Found discount: ${discount.name}`);
        console.log(`   Code: ${discount.code}`);
        console.log(`   Type: ${discount.type}`);
        console.log(`   Value: ${discount.value}${discount.type === 'percentage' ? '%' : ''}`);
        console.log(`   Valid until: ${discount.validUntil}`);
        console.log(`   Usage: ${discount.usageCount}/${discount.usageLimit.total || '∞'}\n`);
        
        // Check existing notifications
        console.log('📬 Checking existing notifications...');
        const existingNotifications = await Notification.find({
            userId: user._id,
            type: 'promotion'
        }).sort({ createdAt: -1 });
        
        console.log(`   Total promotion notifications: ${existingNotifications.length}`);
        if (existingNotifications.length > 0) {
            console.log('   Recent notifications:');
            existingNotifications.slice(0, 3).forEach(n => {
                console.log(`   - ${n.title} (${n.createdAt})`);
            });
        }
        console.log('');
        
        // Ask for confirmation
        console.log('⚠️  Ready to send first-time discount notification');
        console.log('   This will:');
        console.log('   1. Create a promotion notification');
        console.log('   2. Mark user as firstLoginDiscountSent = true');
        console.log('   3. Prevent future automatic sends');
        console.log('');
        
        if (!isEligible) {
            console.log('❌ Cannot proceed: User is not eligible');
            process.exit(1);
        }
        
        // Send notification
        console.log('📤 Sending notification...');
        const result = await sendFirstTimeDiscountNotification(user._id.toString());
        
        if (result.success) {
            console.log('✅ SUCCESS!');
            console.log(`   Message: ${result.message}`);
            console.log(`   Discount Code: ${result.discount.code}`);
            console.log(`   Discount Value: ${result.discount.value}`);
        } else {
            console.log('❌ FAILED');
            console.log(`   Message: ${result.message}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }
        
        console.log('\n✨ Test completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
};

// Get user email from command line
const userEmail = process.argv[2];

if (!userEmail) {
    console.log('❌ Please provide a user email');
    console.log('Usage: node backend/scripts/testFirstTimeDiscount.js <userEmail>');
    console.log('Example: node backend/scripts/testFirstTimeDiscount.js test@example.com');
    process.exit(1);
}

// Run the test
testFirstTimeDiscount(userEmail);
