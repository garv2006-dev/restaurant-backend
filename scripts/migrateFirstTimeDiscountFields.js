/**
 * Migration Script: Add First-Time Discount Fields to Existing Users
 * 
 * This script adds the new firstLoginDiscountSent and firstLoginDiscountSentAt
 * fields to all existing users in the database.
 * 
 * Run this script once after deploying the first-time discount feature.
 * 
 * Usage:
 *   node backend/scripts/migrateFirstTimeDiscountFields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const migrateUsers = async () => {
    try {
        console.log('🔄 Starting migration...');
        console.log('📡 Connecting to database...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to database');
        
        // Find users without the new fields
        const usersToUpdate = await User.countDocuments({
            firstLoginDiscountSent: { $exists: false }
        });
        
        console.log(`📊 Found ${usersToUpdate} users to update`);
        
        if (usersToUpdate === 0) {
            console.log('✨ All users already have the new fields. No migration needed.');
            process.exit(0);
        }
        
        // Update all users without the new fields
        const result = await User.updateMany(
            { firstLoginDiscountSent: { $exists: false } },
            { 
                $set: { 
                    firstLoginDiscountSent: false,
                    firstLoginDiscountSentAt: null
                }
            }
        );
        
        console.log(`✅ Migration completed successfully!`);
        console.log(`📈 Updated ${result.modifiedCount} users`);
        
        // Verify the migration
        const verifyCount = await User.countDocuments({
            firstLoginDiscountSent: { $exists: true }
        });
        
        console.log(`✔️  Verification: ${verifyCount} users now have the new fields`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

// Run the migration
migrateUsers();
