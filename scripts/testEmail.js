const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Test Email Configuration Script
 * Run this to verify your email setup is working correctly
 * Usage: node scripts/testEmail.js
 */

async function testEmailSetup() {
  console.log('🧪 Testing Email Configuration...\n');

  // Check environment variables
  console.log('📋 Checking environment variables:');
  console.log(`   EMAIL_SERVICE: ${process.env.EMAIL_SERVICE || '❌ Not set'}`);
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER || '❌ Not set'}`);
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Set (hidden)' : '❌ Not set'}`);
  console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || '❌ Not set'}\n`);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Error: EMAIL_USER and EMAIL_PASS must be set in .env file');
    console.log('\n📖 Please read EMAIL_SETUP_GUIDE.md for setup instructions');
    process.exit(1);
  }

  // Verify configuration using the utility
  const sendEmail = require('../utils/sendEmail');
  
  console.log('🔧 Verifying email configuration...');
  // The utility automatically validates and logs status on creation

  // Send test email
  const { generateBookingConfirmationEmail } = require('../utils/emailTemplates');

  const mockBooking = {
    bookingId: 'BKMLBVWJRRZA7SE',
    guestDetails: {
      primaryGuest: { name: 'Garv variya' },
      totalAdults: 1,
      totalChildren: 0
    },
    rooms: [
      {
        roomType: { name: 'Royal Executive Suite' },
        roomNumber: '101'
      }
    ],
    bookingDates: {
      checkInDate: new Date(),
      checkOutDate: new Date(Date.now() + 86400000)
    },
    pricing: {
      totalAmount: 9204.00
    }
  };

  console.log('📧 Sending test email using new "Booking Confirmed" template...');
  const testEmail = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    email: 'garvvariya03@gmail.com',
    subject: '🏨 Booking Confirmed - Premium Email Test',
    html: generateBookingConfirmationEmail(mockBooking)
  };

  try {
    await sendEmail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Recipient: garvvariya03@gmail.com\n`);
    console.log('🎉 Email setup is complete and working!');
    console.log('📬 Check your inbox at garvvariya03@gmail.com\n');
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    process.exit(1);
  }
}

// Run the test
testEmailSetup()
  .then(() => {
    console.log('✨ All tests passed! Your contact form is ready to use.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
