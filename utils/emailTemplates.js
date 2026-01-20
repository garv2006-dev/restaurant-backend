// =======================================
// Luxury Hotel – Standardized Email Templates
// Responsive, Styled, Hotel-Bill Theme
// =======================================

/**
 * Master Email Layout
 * Generates a consistent HTML structure for all emails.
 */
const masterEmailLayout = ({
  title,
  themeColor,
  customerName,
  introMessage,
  statusBadge, // { text: 'Confirmed', color: '#...' }
  bookingDetails = [], // Array of { label, value }
  pricingDetails = null, // { items: [{label, value}], total: number }
  messageBody = '',
  footerMessage = ''
}) => {
  // Theme Helpers
  const colors = {
    orange: '#f59e0b',
    blue: '#2563eb',
    teal: '#0d9488',
    gray: '#4b5563',
    red: '#dc2626',
    white: '#ffffff',
    bg: '#f3f4f6'
  };

  const primaryColor = colors[themeColor] || colors.blue;

  // Generate Details Rows
  const detailsRows = bookingDetails.map(item => `
    <tr>
      <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">${item.label}</td>
      <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${item.value}</td>
    </tr>
  `).join('');

  // Generate Pricing Rows
  let pricingSection = '';
  if (pricingDetails) {
    const pricingRows = pricingDetails.items.map(item => `
      <tr>
        <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">${item.label}</td>
        <td style="padding: 6px 0; color: #111827; font-size: 14px; text-align: right;">${item.value}</td>
      </tr>
    `).join('');

    pricingSection = `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${pricingRows}
          <tr>
            <td style="padding-top: 12px; font-size: 16px; font-weight: bold; color: #111827;">Total Amount</td>
            <td style="padding-top: 12px; font-size: 16px; font-weight: bold; color: ${primaryColor}; text-align: right;">${pricingDetails.total}</td>
          </tr>
        </table>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        
        <!-- Main Container -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">${title}</h1>
              <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Luxury Hotel & Rooms</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 24px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear <strong>${customerName}</strong>,</p>
              
              <!-- Intro -->
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563; line-height: 1.5;">${introMessage}</p>

              <!-- Status Badge -->
              ${statusBadge ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="background-color: ${statusBadge.bg}; color: ${statusBadge.text}; padding: 8px 16px; border-radius: 9999px; font-size: 14px; font-weight: 600; display: inline-block;">
                  ${statusBadge.label}
                </span>
              </div>
              ` : ''}

              <!-- Booking Details Card -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; border: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Booking Details</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${detailsRows}
                </table>
                ${pricingSection}
              </div>

              <!-- Extra Message Body -->
              ${messageBody ? `<div style="margin-top: 24px; font-size: 15px; color: #4b5563; line-height: 1.5;">${messageBody}</div>` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #4b5563; font-weight: 600;">Luxury Hotel & Rooms</p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">123 Luxury Avenue, Paradise City</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                <a href="mailto:support@luxuryhotel.com" style="color: ${primaryColor}; text-decoration: none;">support@luxuryhotel.com</a>
                <span style="margin: 0 8px;">•</span>
                <a href="#" style="color: ${primaryColor}; text-decoration: none;">+91 98765 43210</a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af;">${footerMessage || 'Thank you for choosing us.'}</p>
            </td>
          </tr>

        </table>
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
 * Booking Received (Pending Confirmation) - Orange
 */
const generateBookingReceivedEmail = (booking) => {
  return masterEmailLayout({
    title: 'Booking Received',
    themeColor: 'orange',
    customerName: booking.guestDetails.primaryGuest.name,
    introMessage: 'We have received your booking request. Our team is reviewing it now. You will receive a confirmation email once approved.',
    statusBadge: { label: '⏳ Pending Confirmation', bg: '#fff7ed', text: '#c2410c' },
    bookingDetails: [
      { label: 'Booking ID', value: booking.bookingId },
      { label: 'Room Type', value: booking.room.name || 'Standard Room' },
      { label: 'Check-in', value: new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB') },
      { label: 'Check-out', value: new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB') },
      { label: 'Guests', value: `${booking.guestDetails.totalAdults} Adults, ${booking.guestDetails.totalChildren} Children` }
    ]
  });
};

/**
 * Booking Confirmed - Custom Alert Style
 */
const generateBookingConfirmationEmail = (booking) => {
  const totalAmount = booking.pricing.totalAmount.toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333;">
  
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <p style="margin-top: 20px; font-size: 14px; color: #000000;">Dear ${booking.guestDetails.primaryGuest.name},</p>
    
    <p style="margin-bottom: 30px; font-size: 14px; color: #000000;">
      Great news! Your booking has been <strong>confirmed</strong>.
    </p>

    <!-- Green Header -->
    <h3 style="color: #22c55e; font-size: 14px; margin-bottom: 20px; font-weight: bold;">Booking Details:</h3>

    <div style="margin-bottom: 30px;">
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Booking ID:</strong> <span style="color: #333;">${booking.bookingId}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Room:</strong> <span style="color: #333;">${booking.room.name || 'Room'}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-in Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-out Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
       <p style="margin: 8px 0; font-size: 14px;">
        <strong>Number of Nights:</strong> <span style="color: #333;">${booking.bookingDates.nights}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Total Amount:</strong> <span style="color: #333;">₹${totalAmount}</span>
      </p>
    </div>

    <!-- Blue Alert Box -->
    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 30px;">
      <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 14px;">
        ✓ The room is available for your dates.
      </p>
      <p style="margin: 5px 0 0 0; color: #333333; font-size: 13px;">
        You can proceed with your booking. Our team will be ready to welcome you!
      </p>
    </div>

    <div style="margin-top: 40px; font-size: 13px; color: #666666;">
      <p style="margin: 0; font-weight: bold;">Best regards,</p>
      <p style="margin: 5px 0 0 0; font-weight: bold;">Luxury Hotel & Rooms Team</p>
    </div>

  </div>
</body>
</html>
  `;
};

/**
 * Check-In Confirmed - Custom Alert Style
 */
const generateCheckInEmail = (booking, checkInDetails = {}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome! Check-in Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333;">
  
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <p style="margin-top: 20px; font-size: 14px; color: #000000;">Dear ${booking.guestDetails.primaryGuest.name},</p>
    
    <p style="margin-bottom: 30px; font-size: 14px; color: #000000;">
      Welcome to our hotel! You have been successfully checked in.
    </p>

    <!-- Teal Header -->
    <h3 style="color: #0d9488; font-size: 14px; margin-bottom: 20px; font-weight: bold;">Check-in Details:</h3>

    <div style="margin-bottom: 30px;">
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Booking ID:</strong> <span style="color: #333;">${booking.bookingId}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Room:</strong> <span style="color: #333;">${booking.room.name || 'Room'}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-in Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-out Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
    </div>

    <!-- Cyan Alert Box -->
    <div style="background-color: #ecfeff; border-left: 4px solid #06b6d4; padding: 15px; margin-bottom: 30px;">
      <p style="margin: 0; color: #0e7490; font-weight: bold; font-size: 14px;">
        ✓ You are now checked in!
      </p>
      <p style="margin: 5px 0 0 0; color: #333333; font-size: 13px;">
        Enjoy your stay with us. If you need anything, please don't hesitate to contact our front desk.
      </p>
    </div>

    <p style="margin-top: 30px; font-size: 13px; color: #333333;">
      We hope you have a wonderful stay!
    </p>

    <div style="margin-top: 40px; font-size: 13px; color: #666666;">
      <p style="margin: 0; font-weight: bold;">Best regards,</p>
      <p style="margin: 5px 0 0 0; font-weight: bold;">Luxury Hotel & Rooms Team</p>
    </div>

  </div>
</body>
</html>
  `;
};

/**
 * Check-Out Completed - Custom Alert Style
 */
const generateCheckOutEmail = (booking, checkOutDetails = {}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check-out Completed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333;">
  
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <p style="margin-top: 20px; font-size: 14px; color: #000000;">Dear ${booking.guestDetails.primaryGuest.name},</p>
    
    <p style="margin-bottom: 30px; font-size: 14px; color: #000000;">
      Thank you for staying with us! You have been successfully checked out.
    </p>

    <!-- Gray Header -->
    <h3 style="color: #4b5563; font-size: 14px; margin-bottom: 20px; font-weight: bold;">Check-out Details:</h3>

    <div style="margin-bottom: 30px;">
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Booking ID:</strong> <span style="color: #333;">${booking.bookingId}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Room:</strong> <span style="color: #333;">${booking.room.name || 'Room'}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-in Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-out Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
    </div>

    <!-- Gray Alert Box -->
    <div style="background-color: #f9fafb; border-left: 4px solid #6b7280; padding: 15px; margin-bottom: 30px;">
      <p style="margin: 0; color: #374151; font-weight: bold; font-size: 14px;">
        ✓ Check-out completed successfully!
      </p>
      <p style="margin: 5px 0 0 0; color: #333333; font-size: 13px;">
        We hope you enjoyed your stay with us.
      </p>
    </div>

    <p style="margin-top: 30px; font-size: 13px; color: #333333;">
      We would love to hear about your experience. Please consider leaving us a review!
    </p>
    
    <p style="margin-top: 20px; font-size: 13px; color: #333333;">
      We look forward to welcoming you back soon.
    </p>

    <div style="margin-top: 40px; font-size: 13px; color: #666666;">
      <p style="margin: 0; font-weight: bold;">Best regards,</p>
      <p style="margin: 5px 0 0 0; font-weight: bold;">Luxury Hotel & Rooms Team</p>
    </div>

  </div>
</body>
</html>
  `;
};

/**
 * Cancellation - Red (Custom Layout)
 */
const generateCancellationEmail = (booking, cancellationFee = 0, refundAmount = 0) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Cancelled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333;">
  
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Greeting -->
    <p style="margin-top: 20px; font-size: 14px; color: #000000;">Dear ${booking.guestDetails.primaryGuest.name},</p>
    
    <p style="margin-bottom: 30px; font-size: 14px; color: #000000;">We regret to inform you that your booking has been cancelled.</p>

    <!-- Red Header -->
    <h3 style="color: #dc2626; font-size: 14px; margin-bottom: 20px; font-weight: bold;">Booking Details:</h3>

    <!-- Details Grid -->
    <div style="margin-bottom: 30px;">
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Booking ID:</strong> <span style="color: #333;">${booking.bookingId}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Room:</strong> <span style="color: #333;">${booking.room.name || 'Room'}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-in Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
      <p style="margin: 8px 0; font-size: 14px;">
        <strong>Check-out Date:</strong> <span style="color: #333;">${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </p>
    </div>

    <!-- Red Alert Box -->
    <div style="background-color: #fce8e8; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 30px;">
      <p style="margin: 0; color: #7f1d1d; font-weight: bold; font-size: 14px;">
        X Your booking has been cancelled.
      </p>
      <p style="margin: 5px 0 0 0; color: #333333; font-size: 13px;">
        We apologize for any inconvenience caused.
        ${refundAmount > 0 ? `<br>A refund of ₹${refundAmount.toFixed(2)} will be processed shortly.` : ''}
      </p>
    </div>

    <!-- Footer -->
    <p style="margin-top: 30px; font-size: 13px; color: #333333;">
      If you have any questions or would like to make a new booking, please contact us.
    </p>

    <div style="margin-top: 40px; font-size: 13px; color: #666666;">
      <p style="margin: 0; font-weight: bold;">Best regards,</p>
      <p style="margin: 5px 0 0 0; font-weight: bold;">Luxury Hotel & Rooms Team</p>
    </div>

  </div>

</body>
</html>
  `;
};

/**
 * Password Reset - Blue (Simplified)
 */
const generatePasswordResetEmail = (resetUrl) => {
  return masterEmailLayout({
    title: 'Password Reset',
    themeColor: 'blue',
    customerName: 'User',
    introMessage: 'We received a request to reset your password. Click the button below to proceed.',
    bookingDetails: [], // No booking details
    messageBody: `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #6b7280; text-align: center;">Link expires in 10 minutes. If you didn't request this, please ignore this email.</p>
    `
  });
};

module.exports = {
  generateBookingReceivedEmail,
  generateBookingConfirmationEmail,
  generateCheckInEmail,
  generateCheckOutEmail,
  generateCancellationEmail,
  generatePasswordResetEmail
};
