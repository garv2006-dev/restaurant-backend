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
  headerIcon = null, // SVG or icon URL
  statusBadge = null, // { text: 'Confirmed', bg: '#...', color: '#...' }
  bookingDetails = [], // Array of { label, value }
  pricingDetails = null, // { items: [{label, value}], total: number }
  actionButton = null, // { text, url }
  messageBody = '',
  footerLinks = []
}) => {
  const colors = {
    dark: '#111827',
    success: '#10b981',
    danger: '#ef4444',
    info: '#3b82f6',
    border: '#e5e7eb',
    bg: '#f9fafb',
    text: '#374151',
    muted: '#6b7280'
  };

  const primaryColor = colors[themeColor] || colors.dark;

  // Icons based on theme
  const icons = {
    booking: `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #111827;">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="9" y1="21" x2="9" y2="9"></line>
      </svg>`,
    success: `
      <div style="width: 48px; height: 48px; background-color: #ecfeff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>`,
    cancel: `
      <div style="width: 48px; height: 48px; background-color: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>`
  };

  const selectedIcon = headerIcon || icons.booking;

  const detailsRows = bookingDetails.length > 0 ? `
    <div style="margin-top: 32px; border-top: 1px solid ${colors.border}; padding-top: 32px;">
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

  let pricingSection = '';
  if (pricingDetails) {
    pricingSection = `
      <div style="margin-top: 8px; border-top: 1px dashed ${colors.border}; padding-top: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 16px; font-weight: 700; color: ${colors.dark};">Total Amount</td>
            <td style="font-size: 18px; font-weight: 800; color: ${colors.dark}; text-align: right;">₹${pricingDetails.total}</td>
          </tr>
        </table>
      </div>
    `;
  }

  const buttonHtml = actionButton ? `
    <div style="text-align: center; margin-top: 40px;">
      <a href="${actionButton.url}" style="background-color: #111827; color: #ffffff; padding: 14px 32px; border-radius: 4px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Main Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 48px 40px 0 40px; text-align: center;">

              <p style="margin: 0; color: ${colors.muted}; font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Luxury Hotel & Rooms</p>
              <h1 style="margin: 24px 0 8px 0; font-size: 28px; font-weight: 800; color: ${colors.dark}; letter-spacing: -0.5px;">${title}</h1>
              <p style="margin: 0; color: ${colors.muted}; font-size: 15px; font-weight: 500;">Dear ${customerName},</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px 48px 40px;">
              <p style="margin: 0; font-size: 15px; color: ${colors.text}; line-height: 1.6; text-align: center;">
                ${introMessage}
              </p>

              ${statusBadge ? `
              <div style="text-align: center; margin-top: 24px;">
                <span style="background-color: ${statusBadge.bg}; color: ${statusBadge.color}; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
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
            <td style="background-color: #ffffff; padding: 40px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0 0 16px 0; font-size: 12px; color: ${colors.muted};">
                123 Luxury Avenue, Paradise City, PC 560001
                <br>
                +91 98765 43210
              </p>
              <table align="center" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 12px;">
                    <a href="${baseUrl}/terms" style="color: ${colors.muted}; text-decoration: none; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Terms</a>
                  </td>
                  <td style="padding: 0 12px;">
                    <a href="${baseUrl}/privacy" style="color: ${colors.muted}; text-decoration: none; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Privacy</a>
                  </td>
                  <td style="padding: 0 12px;">
                    <a href="${baseUrl}/contact" style="color: ${colors.muted}; text-decoration: none; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Support</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0 0; font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">
                © 2024 LUXURY HOTEL & ROOMS. ALL RIGHTS RESERVED.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Bottom Links -->
        <p style="margin-top: 24px; text-align: center; color: ${colors.muted}; font-size: 11px;">
          Having trouble viewing this email? <a href="${baseUrl}" style="color: ${colors.dark}; text-decoration: none; font-weight: 600;">View in Browser</a>
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
    Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  return masterEmailLayout({
    title: 'Booking Confirmed',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Your reservation is now confirmed. We look forward to welcoming you to our hotel soon. Below are your booking details for your upcoming stay.',
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Rooms', value: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Staying with us' },
      { label: 'Room Numbers', value: booking.rooms.map(r => r.roomNumberInfo?.number || r.roomNumber).join(', ') },
      { label: 'Check-in', value: `${checkInFormatted} at 2:00 PM` },
      { label: 'Check-out', value: `${checkOutFormatted} at 11:00 AM` },
      { label: 'Total Nights', value: `${nights} night${nights !== 1 ? 's' : ''}` }
    ],
    pricingDetails: { total: booking.pricing.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) },
    messageBody: `
      <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937; font-size: 14px;">
          Hotel Timing Information
        </p>
        <ul style="margin: 0; padding-left: 20px; list-style-type: none;">
          <li style="margin-bottom: 8px; font-size: 13px; color: #374151;">
            ✓ <strong>Check-in Time:</strong> 2:00 PM (on ${checkInFormatted})
          </li>
          <li style="margin-bottom: 8px; font-size: 13px; color: #374151;">
            ✓ <strong>Check-out Time:</strong> 11:00 AM (on ${checkOutFormatted})
          </li>
          <li style="font-size: 13px; color: #374151;">
            ✓ <strong>Night Stay Duration:</strong> ${nights} night${nights !== 1 ? 's' : ''} - you will occupy the room(s) for ${nights} night${nights !== 1 ? 's' : ''}.
          </li>
        </ul>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280; font-style: italic;">
          <strong>Note:</strong> Check-out day morning is free for the next booking. Early check-in and late check-out are subject to availability and additional charges may apply.
        </p>
      </div>
    `,
    actionButton: { text: 'Manage My Booking', url: `${baseUrl}/bookings` }
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
    introMessage: 'Your reservation at Luxury Hotel & Rooms has been successfully cancelled. We hope to welcome you back another time.',
    messageBody: `
      <p style="margin-top: 24px; font-size: 14px; text-align: left; color: #374151;">
        As per your request, we have processed the cancellation for your upcoming stay. 
        ${refundAmount > 0 ? `A refund of <strong>₹${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> has been initiated and will be credited to your original payment method within 5-7 business days.` : ''}
      </p>
    `,
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Rooms', value: booking.rooms && booking.rooms.length > 0 ? (booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Executive Room') : 'Executive Room' },
      { label: 'Dates', value: dates },
      { label: 'Guests', value: `${booking.guestDetails.totalAdults} Adult(s)` }
    ],
    actionButton: { text: 'Book a New Stay', url: `${baseUrl}/booking` }
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
    title: 'You are now checked in!',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Welcome! We are delighted to have you with us. Your room is ready for your arrival.',
    statusBadge: { text: '✓ Check-in Confirmed', bg: '#ecfeff', color: '#0d9488' },
    bookingDetails: [
      { label: 'Booking Reference', value: booking.bookingId },
      { label: 'Rooms', value: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Executive Suite' },
      { label: 'Allocated Rooms', value: booking.rooms.map(r => r.roomNumberInfo?.number || r.roomNumber).join(', ') },
      { label: 'Check-in Date', value: new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
      { label: 'Check-out Date', value: checkOutDate }
    ],
    messageBody: `
      <div style="margin-top: 32px; padding: 24px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 16px 0; font-style: italic; color: #4b5563; font-size: 14px;">
          "Enjoy your stay with us. If you need anything, please don't hesitate to contact our front desk by dialing 0 from your room telephone."
        </p>
      </div>
      <div style="margin-top: 24px; padding: 16px; background-color: #fff3cd; border-left: 4px solid #fbbf24; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; font-size: 13px;">
          Check-out Reminder
        </p>
        <p style="margin: 0; font-size: 12px; color: #b45309;">
          Please check out by <strong>11:00 AM on ${checkOutDate}</strong>. Late check-out is available upon request at the front desk (subject to availability and additional charges).
        </p>
      </div>
    `,
    actionButton: { text: 'View My Booking', url: `${baseUrl}/bookings` }
  });
};

/**
 * Thank You / Check-Out
 */
const generateCheckOutEmail = (booking) => {
  const checkInDate = new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const checkOutDate = new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const nights = booking.bookingDates.nights || Math.ceil((new Date(booking.bookingDates.checkOutDate) - new Date(booking.bookingDates.checkInDate)) / (1000 * 60 * 60 * 24));

  return masterEmailLayout({
    title: 'Thank You!',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'Your check-out has been completed successfully. We hope your stay was as exceptional as we intended it to be.',
    statusBadge: { text: '✓ Check-out confirmed successfully', bg: '#f0fdf4', color: '#16a34a' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Rooms', value: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Executive Room' },
      { label: 'Check-in', value: checkInDate },
      { label: 'Check-out', value: checkOutDate },
      { label: 'Total Nights', value: `${nights} night${nights !== 1 ? 's' : ''}` }
    ],
    messageBody: `
      <div style="margin-top: 24px; padding: 16px; background-color: #e0f2fe; border-left: 4px solid #0284c7; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #0c4a6e;">
          Thank you for staying with us! Your booking for <strong>${nights} night${nights !== 1 ? 's' : ''}</strong> from <strong>${checkInDate}</strong> to <strong>${checkOutDate}</strong> has been completed.
        </p>
      </div>
      <div style="margin-top: 24px; text-align: center;">
        <p style="margin: 0 0 16px 0; color: #374151; font-weight: 600; font-size: 14px;">How would you rate your experience?</p>
        <div style="margin-bottom: 24px;">
          <span style="font-size: 24px; color: #e5e7eb; margin: 0 4px;">★</span>
          <span style="font-size: 24px; color: #e5e7eb; margin: 0 4px;">★</span>
          <span style="font-size: 24px; color: #e5e7eb; margin: 0 4px;">★</span>
          <span style="font-size: 24px; color: #e5e7eb; margin: 0 4px;">★</span>
          <span style="font-size: 24px; color: #e5e7eb; margin: 0 4px;">★</span>
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
    introMessage: 'We have received your booking request. Our team is reviewing it now. You will receive a confirmation email once approved.',
    statusBadge: { text: '⏳ Pending Confirmation', bg: '#fff7ed', color: '#c2410c' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Rooms', value: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Standard Room' },
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
      <div style="margin-top: 32px; padding: 32px; background-color: #f9fafb; border: 1px dashed #e5e7eb; border-radius: 8px; text-align: center;">
        <h2 style="margin: 0; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #111827;">${otp}</h2>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #6b7280;">This code will expire in 10 minutes.</p>
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
      <p style="margin-top: 24px; font-size: 13px; color: #6b7280; text-align: center;">
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
    introMessage: 'We noticed that you did not arrive for your scheduled check-in yesterday. As a result, your booking has been marked as a No-Show.',
    statusBadge: { text: '⚠ No-Show Recorded', bg: '#fef2f2', color: '#991b1b' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Rooms', value: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0]?.roomType?.name || 'Standard Room' },
      { label: 'Scheduled Check-in', value: new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
    ],
    messageBody: `
      <p style="margin-top: 24px; font-size: 14px; color: #374151; text-align: center;">
        If this was a mistake or you still intend to visit, please contact our front desk immediately to check for room availability.
      </p>
    `,
    actionButton: { text: 'Contact Support', url: `${baseUrl}/contact` }
  });
};

module.exports = {
  generateBookingReceivedEmail,
  generateBookingConfirmationEmail,
  generateCheckInEmail,
  generateCheckOutEmail,
  generateCancellationEmail,
  generatePasswordResetEmail,
  generateOTPEmail,
  generatePaymentConfirmationEmail,
  generateContactFormEmail,
  generateContactConfirmationEmail,
  generateNoShowEmail
};
