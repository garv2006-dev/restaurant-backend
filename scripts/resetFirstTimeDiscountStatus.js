/**
 * Utility Script: Reset First-Time Discount Status
 * 
 * This script resets the first-time discount status for a user,
 * allowing them to receive the notification again. Useful for testing.
 * 
 * Usage:
 *   node backend/scripts/resetFirstTimeDiscountStatus.js <userEmail>
 * 
 * Example:
 *   node backend/scripts/resetFirstTimeDiscountStatus.js test@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');

const resetUserDiscountStatus = async (userEmail) => {
    try {
        console.log('🔄 Resetting First-Time Discount Status');
        console.log('========================================\n');
        
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
        console.log(`   Current status:`);
        console.log(`   - firstLoginDiscountSent: ${user.firstLoginDiscountSent || false}`);
        console.log(`   - firstLoginDiscountSentAt: ${user.firstLoginDiscountSentAt || 'null'}\n`);
        
        // Reset user fields
        console.log('🔄 Resetting user fields...');
        user.firstLoginDiscountSent = false;
        user.firstLoginDiscountSentAt = null;
        await user.save();
        console.log('✅ User fields reset\n');
        
        // Optionally delete related promotion notifications
        console.log('🗑️  Checking for related promotion notifications...');
        const promotionNotifications = await Notification.find({
            userId: user._id,
            type: 'promotion',
            title: /welcome.*first.*booking/i
        });
        
        if (promotionNotifications.length > 0) {
            console.log(`   Found ${promotionNotifications.length} related notifications`);
            console.log('   Deleting them...');
            
            await Notification.deleteMany({
                userId: user._id,
                type: 'promotion',
                title: /welcome.*first.*booking/i
            });
            
            console.log('✅ Notifications deleted\n');
        } else {
            console.log('   No related notifications found\n');
        }
        
        // Verify reset
        const updatedUser = await User.findById(user._id);
        console.log('✔️  Verification:');
        console.log(`   - firstLoginDiscountSent: ${updatedUser.firstLoginDiscountSent}`);
        console.log(`   - firstLoginDiscountSentAt: ${updatedUser.firstLoginDiscountSentAt}`);
        
        console.log('\n✨ Reset completed successfully!');
        console.log('   User can now receive the first-time discount notification again.');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    }
};

// Get user email from command line
const userEmail = process.argv[2];

if (!userEmail) {
    console.log('❌ Please provide a user email');
    console.log('Usage: node backend/scripts/resetFirstTimeDiscountStatus.js <userEmail>');
    console.log('Example: node backend/scripts/resetFirstTimeDiscountStatus.js test@example.com');
    process.exit(1);
}

// Run the reset
resetUserDiscountStatus(userEmail);
