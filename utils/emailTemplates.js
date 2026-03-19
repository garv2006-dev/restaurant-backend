// =======================================
// Luxury Hotel – Modern & Professional Email Templates
// Based on Premium Hotel Design Aesthetics
// =======================================

/**
 * Master Email Layout
 * Generates a consistent, premium HTML structure for all emails.
 */
const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

const masterEmailLayout = ({
  title,
  themeColor = 'dark', // 'dark', 'success', 'danger', 'info'
  customerName,
  introMessage,
  headerIcon = null,
  statusBadge = null,
  bookingDetails = [],
  pricingDetails = null,
  actionButton = null,
  messageBody = '',
  footerLinks = []
}) => {
  const colors = {
    dark: '#111827',
    success: '#10b981',
    danger: '#ef4444',
    info: '#3b82f6',
    border: '#f3f4f6',
    bg: '#ffffff',
    text: '#374151',
    muted: '#6b7280'
  };

  const primaryColor = colors[themeColor] || colors.dark;

  const detailsRows = bookingDetails.length > 0 ? `
    <div style="margin-top: 32px; border-top: 1px solid ${colors.border}; padding-top: 32px; text-align: left;">
      <h3 style="margin: 0 0 16px 0; font-size: 11px; color: ${colors.muted}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Booking Details</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${bookingDetails.map(item => `
          <tr>
            <td style="padding: 12px 0; color: ${colors.muted}; font-size: 14px; width: 45%;">${item.label}</td>
            <td style="padding: 12px 0; color: ${colors.dark}; font-size: 14px; font-weight: 600; text-align: right;">${item.value}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  ` : '';

  const pricingSection = pricingDetails ? `
    <div style="margin-top: 8px; border-top: 1px dashed ${colors.border}; padding-top: 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size: 16px; font-weight: 700; color: ${colors.dark};">Total Amount</td>
          <td style="font-size: 18px; font-weight: 800; color: ${colors.dark}; text-align: right;">₹${pricingDetails.total}</td>
        </tr>
      </table>
    </div>
  ` : '';

  const buttonHtml = actionButton ? `
    <div style="text-align: center; margin-top: 40px;">
      <a href="${actionButton.url}" style="background-color: #111827; color: #ffffff; padding: 16px 40px; border-radius: 4px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block;">
        ${actionButton.text}
      </a>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 16px; color: #4b5563; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9fafb; padding: 60px 0;">
    <tr>
      <td align="center">
        <!-- Main Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border: 1px solid #f3f4f6; border-radius: 0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 60px 40px 0 40px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">Luxury Hotel & Rooms</p>
              <h1 style="margin: 32px 0 12px 0; font-size: 32px; font-weight: 800; color: #111827; letter-spacing: -1px; text-align: center;">${title}</h1>
              <p style="margin: 0; color: #4b5563; font-size: 16px; font-weight: 500; text-align: center;">Dear ${customerName},</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 48px 60px 48px; text-align: center;">
              <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.7; text-align: center;">
                ${introMessage}
              </p>

              ${statusBadge ? `
              <div style="text-align: center; margin-top: 32px;">
                <span style="background-color: ${statusBadge.bg}; color: ${statusBadge.color}; padding: 8px 16px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">
                  ${statusBadge.text}
                </span>
              </div>
              ` : ''}

              ${detailsRows}
              ${pricingSection}
              ${messageBody}
              ${buttonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #ffffff; padding: 60px 40px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center;">
                123 Luxury Avenue, Paradise City, PC 560001
                <br>
                +91 98765 43210
              </p>
              <table align="center" style="margin: 24px auto 0 auto;">
                <tr>
                  <td style="padding: 0 16px;">
                    <a href="${baseUrl}/terms" style="color: #4b5563; text-decoration: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Terms</a>
                  </td>
                  <td style="padding: 0 16px;">
                    <a href="${baseUrl}/privacy" style="color: #4b5563; text-decoration: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Privacy</a>
                  </td>
                  <td style="padding: 0 16px;">
                    <a href="${baseUrl}/contact" style="color: #4b5563; text-decoration: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Support</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 40px 0 0 0; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; font-weight: 500; text-align: center;">
                © 2024 LUXURY HOTEL & ROOMS. ALL RIGHTS RESERVED.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Bottom Links -->
        <p style="margin-top: 32px; text-align: center; color: #9ca3af; font-size: 12px;">
          Having trouble viewing this email? <a href="${baseUrl}" style="color: #111827; text-decoration: none; font-weight: 700;">View in Browser</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ============================
// EMAIL GENERATORS
// ============================

/**
 * Booking Confirmed
 */
const generateBookingConfirmationEmail = (booking) => {
  const checkInDate = new Date(booking.bookingDates.checkInDate);
  const checkOutDate = new Date(booking.bookingDates.checkOutDate);

  const checkInFormatted = checkInDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const checkOutFormatted = checkOutDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const nights = booking.bookingDates.nights ||
    Math.round((new Date(checkOutDate).setHours(0, 0, 0, 0) - new Date(checkInDate).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

  return masterEmailLayout({
    title: 'Booking Confirmed',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Your stay at Luxury Hotel & Rooms is confirmed. We are preparing for your arrival and look forward to hosting you.',
    statusBadge: { text: 'Confirmed', bg: '#f0fdf4', color: '#16a34a' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Check-in', value: `${checkInFormatted} @ 2:00 PM` },
      { label: 'Check-out', value: `${checkOutFormatted} @ 11:00 AM` },
      { label: 'Stay Duration', value: `${nights} Night${nights !== 1 ? 's' : ''}` },
      { label: 'Room Info', value: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Staying with us' }
    ],
    pricingDetails: { total: booking.pricing.totalAmount.toLocaleString('en-IN') },
    actionButton: { text: 'Manage Booking', url: `${baseUrl}/bookings` }
  });
};

/**
 * Booking Cancelled
 */
const generateCancellationEmail = (booking, cancellationFee = 0, refundAmount = 0) => {
  const dates = `${new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return masterEmailLayout({
    title: 'Booking Cancelled',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Your reservation at Luxury Hotel & Rooms has been cancelled. We hope to have the opportunity to serve you in the future.',
    statusBadge: { text: 'Cancelled Successfully', bg: '#fef2f2', color: '#dc2626' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Stay Dates', value: dates },
      { label: 'Guest Name', value: booking.guestDetails.primaryGuest.name }
    ],
    messageBody: refundAmount > 0 ? `
      <p style="margin-top: 32px; font-size: 14px; color: #6b7280; text-align: center;">
        A refund of <strong>₹${refundAmount.toLocaleString('en-IN')}</strong> is being processed and will appear in your account within 5-7 business days.
      </p>
    ` : '',
    actionButton: { text: 'Book New Stay', url: `${baseUrl}/booking` }
  });
};

/**
 * Check-In Confirmed
 */
const generateCheckInEmail = (booking) => {
  const checkOutDate = new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return masterEmailLayout({
    title: 'Check-in Confirmed',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Welcome to Luxury Hotel & Rooms. We are delighted to have you with us. Your room is ready and your check-in is complete.',
    statusBadge: { text: 'Checked In', bg: '#ecfeff', color: '#0891b2' },
    bookingDetails: [
      { label: 'Reference ID', value: booking.bookingId },
      { label: 'Room Number', value: booking.rooms.map(r => r.roomNumberInfo?.number || r.roomNumber).join(', ') },
      { label: 'Check-out', value: `${checkOutDate} @ 11:00 AM` }
    ],
    messageBody: `
      <p style="margin-top: 32px; font-size: 15px; color: #6b7280; font-style: italic; text-align: center;">
        "We wish you a pleasant and memorable stay."
      </p>
    `,
    actionButton: { text: 'View Service Directory', url: `${baseUrl}/bookings` }
  });
};

/**
 * Thank You / Check-Out
 */
const generateCheckOutEmail = (booking) => {
  return masterEmailLayout({
    title: 'Check-out Complete',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Thank you for choosing Luxury Hotel & Rooms. Your check-out has been successfully processed. We hope to see you again soon.',
    statusBadge: { text: 'Checked Out', bg: '#f0fdf4', color: '#16a34a' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Guest Name', value: booking.guestDetails.primaryGuest.name }
    ],
    messageBody: `
      <div style="margin-top: 40px; text-align: center;">
        <p style="margin: 0 0 24px 0; color: #111827; font-weight: 700; font-size: 16px;">How was your experience?</p>
        <div style="margin-bottom: 32px;">
          <span style="font-size: 32px; color: #f3f4f6; margin: 0 8px; cursor: pointer;">★</span>
          <span style="font-size: 32px; color: #f3f4f6; margin: 0 8px; cursor: pointer;">★</span>
          <span style="font-size: 32px; color: #f3f4f6; margin: 0 8px; cursor: pointer;">★</span>
          <span style="font-size: 32px; color: #f3f4f6; margin: 0 8px; cursor: pointer;">★</span>
          <span style="font-size: 32px; color: #f3f4f6; margin: 0 8px; cursor: pointer;">★</span>
        </div>
      </div>
    `,
    actionButton: { text: 'Leave a Review', url: `${baseUrl}/bookings` }
  });
};

/**
 * Booking Received (Pending)
 */
const generateBookingReceivedEmail = (booking) => {
  return masterEmailLayout({
    title: 'Booking Received',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'We have successfully received your booking request. Our reservations team is currently reviewing your details.',
    statusBadge: { text: 'Pending Approval', bg: '#fff7ed', color: '#c2410c' },
    bookingDetails: [
      { label: 'Reference ID', value: booking.bookingId },
      { label: 'Check-in', value: new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
      { label: 'Check-out', value: new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
    ],
    actionButton: { text: 'Check Status', url: `${baseUrl}/bookings` }
  });
};

/**
 * OTP / Verification
 */
const generateOTPEmail = (otp, customerName = 'Guest') => {
  return masterEmailLayout({
    title: 'Verification Code',
    customerName: customerName,
    introMessage: 'Please use the following one-time password (OTP) to verify your account or complete your request.',
    messageBody: `
      <div style="margin-top: 32px; padding: 32px; background-color: #f9fafb; border: 1px dashed #e5e7eb; border-radius: 4px; text-align: center;">
        <h2 style="margin: 0; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #111827;">${otp}</h2>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #6b7280;">For security, this code will expire in 10 minutes.</p>
      </div>
    `
  });
};

const generatePasswordResetEmail = (resetUrl) => {
  return masterEmailLayout({
    title: 'Reset Your Password',
    customerName: 'Guest',
    introMessage: 'We received a request to reset your password. If you didn\'t make this request, you can safely ignore this email.',
    actionButton: { text: 'Reset Password', url: resetUrl },
    messageBody: `
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280; text-align: center;">
        For security, this link will expire in 1 hour.
      </p>
    `
  });
};

/**
 * Payment Confirmation
 */
const generatePaymentConfirmationEmail = (booking, paymentDetails) => {
  return masterEmailLayout({
    title: 'Payment Received',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Thank you! Your payment has been successfully processed. Your reservation is now fully confirmed.',
    statusBadge: { text: '✓ Payment Successful', bg: '#f0fdf4', color: '#16a34a' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Amount Paid', value: `₹${paymentDetails.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
      { label: 'Transaction ID', value: paymentDetails.transactionId },
      { label: 'Payment Date', value: new Date(paymentDetails.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
    ],
    actionButton: { text: 'View Booking', url: `${baseUrl}/bookings` }
  });
};

/**
 * Contact Form Notification (Admin)
 */
const generateContactFormEmail = (contactData) => {
  return masterEmailLayout({
    title: 'New Contact Request',
    customerName: 'Admin',
    introMessage: 'A new message has been submitted via the contact form on your website.',
    headerIcon: `
      <div style="width: 48px; height: 48px; background-color: #fefce8; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>`,
    bookingDetails: [
      { label: 'Name', value: contactData.name },
      { label: 'Email', value: contactData.email },
      { label: 'Phone', value: contactData.phone },
      { label: 'Subject', value: contactData.subject }
    ],
    messageBody: `
      <div style="margin-top: 32px; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
        <h4 style="margin: 0 0 12px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Message</h4>
        <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${contactData.message}</p>
      </div>
    `,
    actionButton: { text: 'Reply via Email', url: `mailto:${contactData.email}` }
  });
};

/**
 * Contact Form Confirmation (User)
 */
const generateContactConfirmationEmail = (name, subject, message) => {
  return masterEmailLayout({
    title: 'Message Received',
    customerName: name,
    introMessage: 'Thank you for reaching out to Luxury Hotel. We have received your message and will get back to you within 24 hours.',
    headerIcon: `
      <div style="width: 48px; height: 48px; background-color: #ecfeff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      </div>`,
    messageBody: `
      <div style="margin-top: 32px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; font-weight: 600;">Subject: ${subject}</p>
        <p style="margin: 0; font-size: 14px; color: #374151; font-style: italic;">"${message}"</p>
      </div>
    `,
    actionButton: { text: 'Visit Our Website', url: `${baseUrl}` }
  });
};

const generateNoShowEmail = (booking) => {
  return masterEmailLayout({
    title: 'Booking No-Show',
    themeColor: 'danger',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'We missed you at Luxury Hotel & Rooms. As we did not receive an arrival for your scheduled check-in, your booking has been recorded as a No-Show.',
    statusBadge: { text: 'No-Show Recorded', bg: '#fef2f2', color: '#991b1b' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Scheduled Check-in', value: new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
    ],
    messageBody: `
      <p style="margin-top: 32px; font-size: 15px; color: #6b7280; text-align: center;">
        If there was an error or you still wish to visit, please contact our front desk immediately.
      </p>
    `,
    actionButton: { text: 'Contact Support', url: `${baseUrl}/contact` }
  });
};

/**
 * Partial Cancellation
 */
const generatePartialCancellationEmail = (booking, cancelledRoomsCount, activeRoomsCount) => {
  const dates = `${new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return masterEmailLayout({
    title: 'Stay Modified',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: `Your reservation has been successfully modified. We have processed the cancellation for ${cancelledRoomsCount} room(s).`,
    statusBadge: { text: 'Reservation Modified', bg: '#fff7ed', color: '#c2410c' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Active Rooms', value: `${activeRoomsCount} Room(s)` },
      { label: 'Stay Dates', value: dates }
    ],
    pricingDetails: { total: booking.pricing.totalAmount.toLocaleString('en-IN') },
    actionButton: { text: 'View Updated Booking', url: `${baseUrl}/bookings` }
  });
};

/**
 * Offline Booking Confirmation
 */
const generateOfflineBookingEmail = (booking) => {
  const checkInDate = new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const checkOutDate = new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const isCheckedIn = booking.status === 'CheckedIn';

  return masterEmailLayout({
    title: isCheckedIn ? 'Welcome to Luxury Hotel' : 'Booking Confirmed',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: isCheckedIn 
      ? 'Your check-in is complete. We are delighted to have you stay with us.'
      : 'Your reservation has been successfully confirmed. We look forward to your arrival.',
    statusBadge: { 
      text: isCheckedIn ? 'Checked In' : 'Confirmed', 
      bg: '#f0fdf4', 
      color: '#16a34a' 
    },
    bookingDetails: [
      { label: 'Reference ID', value: booking.bookingId },
      { label: 'Room Number', value: booking.rooms.map(r => r.roomNumberInfo?.number || r.roomNumber).join(', ') },
      { label: 'Check-in', value: checkInDate },
      { label: 'Check-out', value: `${checkOutDate} @ 11:00 AM` }
    ],
    actionButton: { text: 'View Booking', url: `${baseUrl}/bookings` }
  });
};

module.exports = {
  generateBookingReceivedEmail,
  generateBookingConfirmationEmail,
  generateCheckInEmail,
  generateCheckOutEmail,
  generateCancellationEmail,
  generatePartialCancellationEmail,
  generatePasswordResetEmail,
  generateOTPEmail,
  generatePaymentConfirmationEmail,
  generateContactFormEmail,
  generateContactConfirmationEmail,
  generateNoShowEmail,
  generateOfflineBookingEmail
};
