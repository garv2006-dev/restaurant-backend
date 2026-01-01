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
  console.log('📧 Sending test email...');
  const testEmail = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: 'garvvariya03@gmail.com',
    subject: '✅ Test Email - Contact Form Setup Successful',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .header {
            background-color: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 5px 5px;
          }
          .success-icon {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
          .info-box {
            background-color: #f5f5f5;
            padding: 15px;
            border-left: 4px solid #4CAF50;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎉 Email Setup Successful!</h2>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            
            <p>Congratulations! Your email configuration is working correctly.</p>
            
            <div class="info-box">
              <strong>Configuration Details:</strong><br>
              <strong>Service:</strong> ${process.env.EMAIL_SERVICE || 'gmail'}<br>
              <strong>From:</strong> ${process.env.EMAIL_USER}<br>
              <strong>Test Time:</strong> ${new Date().toLocaleString()}
            </div>
            
            <p>Your contact form is now ready to receive and send emails!</p>
            
            <p><strong>What happens next:</strong></p>
            <ul>
              <li>Users can submit the contact form on your website</li>
              <li>You'll receive notifications at: garvvariya03@gmail.com</li>
              <li>Users will receive automatic confirmation emails</li>
            </ul>
            
            <p>Best regards,<br>
            <strong>Luxury Hotel System</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
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
