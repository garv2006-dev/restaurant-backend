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

  // Create transporter
  console.log('🔧 Creating email transporter...');
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Verify connection
  console.log('🔌 Verifying connection to email server...');
  try {
    await transporter.verify();
    console.log('✅ Connection successful!\n');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n💡 Common issues:');
    console.log('   - Using regular password instead of App Password');
    console.log('   - 2-Factor Authentication not enabled');
    console.log('   - Incorrect email address');
    console.log('\n📖 Please read EMAIL_SETUP_GUIDE.md for troubleshooting');
    process.exit(1);
  }

  // Send test email
  const { generateBookingConfirmationEmail } = require('../utils/emailTemplates');

  const mockBooking = {
    bookingId: 'BKMLBVWJRRZA7SE',
    guestDetails: {
      primaryGuest: { name: 'Garv variya' },
      totalAdults: 1,
      totalChildren: 0
    },
    room: { name: 'Royal Executive Suite' },
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
    to: 'garvvariya03@gmail.com',
    subject: '🏨 Booking Confirmed - Premium Email Test',
    html: generateBookingConfirmationEmail(mockBooking)
  };

  try {
    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Recipient: garvvariya03@gmail.com\n`);
    console.log('🎉 Email setup is complete and working!');
    console.log('📬 Check your inbox at garvvariya03@gmail.com\n');
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    console.log('\n📖 Please read EMAIL_SETUP_GUIDE.md for troubleshooting');
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
