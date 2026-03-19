const { Resend } = require('resend');
const { 
  generateBookingReceivedEmail,
  generateBookingConfirmationEmail, 
  generatePasswordResetEmail, 
  generateOTPEmail,
  generateCheckInEmail,
  generateCheckOutEmail,
  generateCancellationEmail,
  generateNoShowEmail,
  generatePaymentConfirmationEmail
} = require('../utils/emailTemplates');

/**
 * Service to handle all email-related logic using Resend API.
 * This class provides a centralized way to send transactional emails.
 */
class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@send.luxuryhotelrooms.site';
    this.senderName = process.env.SENDER_NAME || 'Luxury Hotel';
    this.from = `${this.senderName} <${this.fromEmail}>`;
  }

  /**
   * General purpose send email function
   * @param {Object} options - Email options (to, subject, html, text)
   * @returns {Promise<Object>} - Resend API response
   */
  async send(options) {
    try {
      const { to, subject, html, text, tags, attachments } = options;

      if (!to || !subject) {
        throw new Error('Recipient email and subject are required.');
      }

      console.log(`[EmailService] Sending email to: ${to}, subject: ${subject}`);

      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || '',
        tags: tags || [],
        attachments: attachments || []
      });

      if (error) {
        console.error(`[EmailService] Resend Error:`, error);
        throw new Error(error.message || 'Failed to send email via Resend.');
      }

      console.log(`[EmailService] Email sent successfully. ID: ${data.id}`);
      return { success: true, data };
    } catch (err) {
      console.error(`[EmailService] Internal Error:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send Booking Confirmation Email
   * @param {string} to - Recipient email
   * @param {Object} booking - Booking details
   */
  async sendBookingConfirmation(to, booking) {
    const html = generateBookingConfirmationEmail(booking);
    return this.send({
      to,
      subject: `Booking Confirmed #${booking.bookingId} - Luxury Hotel`,
      html
    });
  }

  /**
   * Send Booking Received Email (Pending)
   * @param {string} to - Recipient email
   * @param {Object} booking - Booking details
   */
  async sendBookingReceived(to, booking) {
    const html = generateBookingReceivedEmail(booking);
    return this.send({
      to,
      subject: `Booking Received - ${booking.bookingId}`,
      html
    });
  }

  /**
   * Send Password Reset Email
   * @param {string} to - Recipient email
   * @param {string} resetUrl - Password reset URL
   */
  async sendPasswordReset(to, resetUrl) {
    const html = generatePasswordResetEmail(resetUrl);
    return this.send({
      to,
      subject: 'Reset Your Password - Luxury Hotel',
      html
    });
  }

  /**
   * Send OTP Verification Email
   * @param {string} to - Recipient email
   * @param {string} otp - One-time password
   * @param {string} name - Guest name
   */
  async sendOTP(to, otp, name = 'Guest') {
    const html = generateOTPEmail(otp, name);
    return this.send({
      to,
      subject: `${otp} is your verification code - Luxury Hotel`,
      html
    });
  }

  /**
   * Send Contact Form Notification to Admin
   * @param {Object} contactData - Contact form data
   */
  async sendContactForm(contactData) {
    const html = generateContactFormEmail(contactData);
    return this.send({
      to: 'garvvariya03@gmail.com', // Admin email
      subject: `New Contact Form Submission: ${contactData.subject}`,
      html
    });
  }

  /**
   * Send Contact Form Confirmation to User
   * @param {string} to - User email
   * @param {string} name - User name
   * @param {string} subject - Original subject
   * @param {string} message - Original message
   */
  async sendContactConfirmation(to, name, subject, message) {
    const html = generateContactConfirmationEmail(name, subject, message);
    return this.send({
      to,
      subject: 'Thank you for contacting Luxury Hotel',
      html
    });
  }

  /**
   * Send Payment Confirmation Email
   * @param {string} to - Recipient email
   * @param {Object} booking - Booking details
   * @param {Object} paymentDetails - Payment details
   */
  async sendPaymentConfirmation(to, booking, paymentDetails) {
    const html = generatePaymentConfirmationEmail(booking, paymentDetails);
    return this.send({
      to,
      subject: `Payment Confirmation - ${booking.bookingId}`,
      html
    });
  }

  /**
   * Send Booking Status Update Email
   * @param {string} to - Recipient email
   * @param {Object} booking - Booking details
   * @param {string} status - New status
   */
  async sendBookingStatusUpdate(to, booking, status) {
    let html = '';
    let subject = '';

    switch (status) {
      case 'Pending':
        html = generateBookingReceivedEmail(booking);
        subject = `Booking Pending - ${booking.bookingId}`;
        break;
      case 'Confirmed':
        html = generateBookingConfirmationEmail(booking);
        subject = `Booking Confirmed - ${booking.bookingId}`;
        break;
      case 'Cancelled':
        const paymentMethod = booking.paymentDetails?.method || '';
        const isCashPayment = paymentMethod.toLowerCase() === 'cash';
        const cancellationFee = isCashPayment ? booking.pricing.totalAmount : 0;
        const refundAmount = isCashPayment ? 0 : booking.pricing.totalAmount;
        html = generateCancellationEmail(booking, cancellationFee, refundAmount);
        subject = `Booking Cancelled - ${booking.bookingId}`;
        break;
      case 'CheckedIn':
        html = generateCheckInEmail(booking);
        subject = `Welcome! Check-in Confirmed - ${booking.bookingId}`;
        break;
      case 'CheckedOut':
        html = generateCheckOutEmail(booking);
        subject = `Thank You! Check-out Completed - ${booking.bookingId}`;
        break;
      case 'NoShow':
        html = generateNoShowEmail(booking);
        subject = `No Show - ${booking.bookingId}`;
        break;
      default:
        return;
    }

    if (html && to) {
      return this.send({ to, subject, html });
    }
  }
}

// Singleton instance
module.exports = new EmailService();
