const sendEmail = require('../utils/sendEmail');
const { generateContactFormEmail, generateContactConfirmationEmail } = require('../utils/emailTemplates');

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

    // Send emails using the shared utility
    // Send to Admin
    const adminHtml = generateContactFormEmail({ name, email, phone, subject, message });
    await sendEmail({
      email: 'garvvariya03@gmail.com',
      subject: `New Contact Form Submission: ${subject}`,
      message: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nSubject: ${subject}\nMessage: ${message}`,
      html: adminHtml
    });

    // Send to User
    const userHtml = generateContactConfirmationEmail(name, subject, message);
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
