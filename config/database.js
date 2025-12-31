const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Connection pool settings - increased for better concurrency
            maxPoolSize: 20,
            minPoolSize: 5,
            socketTimeoutMS: 60000, // Increased from 45s to 60s
            serverSelectionTimeoutMS: 15000, // Increased from 10s to 15s
            heartbeatFrequencyMS: 10000,
            
            // Retry settings
            retryWrites: true,
            retryReads: true,
            
            // Performance settings
            maxIdleTimeMS: 60000, // Increased from 30s to 60s
            connectTimeoutMS: 15000, // Increased from 10s to 15s
            
            // Additional stability settings
            waitQueueTimeoutMS: 10000, // Timeout for waiting for available connection
            compressors: ['zlib'], // Enable compression for better performance
        });

        console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);

        // Log connection events
        mongoose.connection.on('connected', () => {
            console.log('✅ Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ Mongoose connection error:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  Mongoose disconnected from MongoDB');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 Mongoose reconnected to MongoDB');
        });

        // Graceful exit
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('Mongoose connection closed due to application termination');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await mongoose.connection.close();
            console.log('Mongoose connection closed due to SIGTERM');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;