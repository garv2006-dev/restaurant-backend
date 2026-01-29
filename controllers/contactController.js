const sendEmail = require('../utils/sendEmail');

// @desc    Send contact form email
// @route   POST /api/contact
// @access  Public
exports.sendContactEmail = async (req, res) => {
  console.log('Contact form submission received');
  try {
    const { name, email, phone, subject, message } = req.body;

    // Log configuration status (without exposing secrets)
    console.log('Email configuration check:', {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
      hasBrevoKey: !!process.env.BREVO_API_KEY,
      emailService: process.env.EMAIL_SERVICE || 'default'
    });


    // Validation - Check required fields
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Name validation
    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long'
      });
    }

    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Name can only contain letters and spaces'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Phone validation
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be at least 10 digits'
      });
    }

    if (phoneDigits.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Phone number cannot exceed 15 digits'
      });
    }

    if (!/^[0-9+\-\s()]+$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number'
      });
    }

    // Message validation
    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long'
      });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 1000 characters'
      });
    }

    // Email to admin
    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #d4af37; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
          .field { margin-bottom: 20px; }
          .field-label { font-weight: bold; color: #d4af37; margin-bottom: 5px; }
          .field-value { padding: 10px; background-color: #f5f5f5; border-left: 3px solid #d4af37; border-radius: 3px; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🏨 New Contact Form Submission</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">Name:</div>
              <div class="field-value">${name}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Email:</div>
              <div class="field-value"><a href="mailto:${email}">${email}</a></div>
            </div>
            
            <div class="field">
              <div class="field-label">Phone:</div>
              <div class="field-value"><a href="tel:${phone}">${phone}</a></div>
            </div>
            
            <div class="field">
              <div class="field-label">Subject:</div>
              <div class="field-value">${subject}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Message:</div>
              <div class="field-value">${message.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="footer">
              <p>This email was sent from the Luxury Hotel contact form</p>
              <p>Received on: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: true })}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Confirmation email to user
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #d4af37; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
          .message-box { background-color: #f5f5f5; padding: 15px; border-left: 4px solid #d4af37; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🏨 Thank You for Contacting Us!</h2>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            
            <p>Thank you for reaching out to Luxury Hotel. We have received your message and our team will get back to you within 24 hours.</p>
            
            <div class="message-box">
              <strong>Your Message:</strong><br>
              <strong>Subject:</strong> ${subject}<br>
              <strong>Message:</strong> ${message}
            </div>
            
            <p>If you need immediate assistance, please feel free to call us at:</p>
            <p><strong>📞 +91 (22) 1234-5678</strong></p>
            
            <p>Best regards,<br>
            <strong>Luxury Hotel Team</strong></p>
            
            <div class="footer">
              <p>Luxury Hotel | 123 Luxury Street, Premium District, Mumbai</p>
              <p>📧 info@luxuryhotel.com | 📞 +91 (22) 1234-5678</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails using the shared utility (supports Brevo/Gmail automatically)
    // Send to Admin
    await sendEmail({
      email: 'garvvariya03@gmail.com',
      subject: `New Contact Form Submission: ${subject}`,
      message: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`,
      html: adminHtml
    });

    // Send to User
    await sendEmail({
      email: email,
      subject: 'Thank you for contacting Luxury Hotel',
      message: `Dear ${name},\n\nThank you for reaching out. We have received your message: "${subject}".\n\nBest,\nLuxury Hotel Team`,
      html: userHtml
    });

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully! We will get back to you within 24 hours.'
    });

  } catch (error) {
    console.error('Contact form error details:', {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later or contact us directly.'
    });
  }
};
