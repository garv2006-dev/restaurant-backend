/**
 * Test Resend Integration Script
 * This script verifies the Resend Node.js SDK integration in utils/sendEmail.js
 * following the mandated guardrails.
 * 
 * Usage: RESEND_API_KEY=re_... node scripts/testResend.js
 */

require('dotenv').config();
const sendEmail = require('../utils/sendEmail');

async function testResend() {
    console.log('🧪 Testing Resend Integration...\n');

    if (!process.env.RESEND_API_KEY) {
        console.error('❌ Error: RESEND_API_KEY must be set in your environment or .env file.');
        console.log('For testing, you can run:');
        console.log('RESEND_API_KEY=re_your_key node scripts/testResend.js\n');
        process.exit(1);
    }

    const testOptions = {
        email: 'delivered@resend.dev', // Resend test address
        subject: 'Resend Integration Test',
        message: 'This is a test email from the new Resend integration.',
        html: '<strong>It works!</strong> This is a test from the <code>restaurant-backend</code>.',
        tags: [{ name: 'category', value: 'test' }],
        idempotencyKey: `test-${Date.now()}`
    };

    console.log('📤 Sending test email to delivered@resend.dev...');
    
    try {
        // We use the exported sendEmail which now prioritizes Resend if the API key is present
        const result = await sendEmail(testOptions);
        
        if (result) {
            console.log('✅ Success! The email was sent (or at least accepted by the SDK).');
            console.log('Check your Resend dashboard for the delivery status.');
        } else {
            console.error('❌ Failed! sendEmail returned falsy.');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Unexpected Error during test execution:', error.message);
        process.exit(1);
    }
}

testResend();
