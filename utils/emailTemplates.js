// =======================================
// Luxury Hotel – Production Email Templates
// Compact, email-client-safe HTML
// =======================================

const baseLayout = (title, body) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding:20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">

<tr>
<td style="background:#4a90e2;color:#ffffff;text-align:center;padding:20px;">
<h1 style="margin:0;font-size:20px;letter-spacing:1px;">${title}</h1>
</td>
</tr>

<tr>
<td style="padding:25px;font-size:14px;color:#333;line-height:1.6;">
${body}
</td>
</tr>

<tr>
<td style="background:#f4f6f8;padding:15px;text-align:center;font-size:12px;color:#666;">
<strong>Luxury Hotel</strong><br/>
123 Luxury Avenue, NY 10001<br/>
support@luxuryhotel.com<br/>
© ${new Date().getFullYear()}
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
`;

// ============================
// PASSWORD RESET EMAIL
// ============================

const generatePasswordResetEmail = (resetUrl) => {
  return baseLayout(
    "Password Reset Request",
    `
    <p>Hello,</p>
    <p>We received a request to reset your password.</p>

    <p style="text-align:center;margin:25px 0;">
      <a href="${resetUrl}" style="background:#4a90e2;color:#fff;
      text-decoration:none;padding:12px 25px;border-radius:5px;display:inline-block;">
        Reset Password
      </a>
    </p>

    <p style="font-size:13px;color:#666;">
      This link expires in <strong>10 minutes</strong>.  
      If you didn’t request this, please ignore this email.
    </p>
    `
  );
};

// ============================
// BOOKING CONFIRMATION EMAIL
// ============================

const generateBookingConfirmationEmail = (
  booking,
  guestDetails,
  checkIn,
  checkOut,
  nights,
  roomPrice,
  subtotal,
  gst,
  totalAmount,
  extraServices,
  specialRequests,
  paymentDetails
) => {

  const extras = extraServices?.map(s => `
    <tr>
      <td>${s.name}</td>
      <td align="right">₹${(s.price * s.quantity).toFixed(2)}</td>
    </tr>
  `).join("") || "";

  return baseLayout(
    "Booking Confirmation",
    `
    <p>Dear <strong>${guestDetails.primaryGuest.name}</strong>,</p>
    <p>Your booking has been confirmed 🎉</p>

    <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
      <tr><td>Booking ID</td><td align="right">${booking.bookingId}</td></tr>
      <tr><td>Room</td><td align="right">${booking.room.name}</td></tr>
      <tr><td>Check-in</td><td align="right">${checkIn.toDateString()}</td></tr>
      <tr><td>Check-out</td><td align="right">${checkOut.toDateString()}</td></tr>
      <tr><td>Nights</td><td align="right">${nights}</td></tr>
    </table>

    <hr style="margin:15px 0;"/>

    <table width="100%" cellpadding="6">
      <tr><td>Room Charges</td><td align="right">₹${roomPrice.toFixed(2)}</td></tr>
      ${extras}
      <tr><td>GST</td><td align="right">₹${gst.toFixed(2)}</td></tr>
      <tr>
        <td><strong>Total</strong></td>
        <td align="right"><strong>₹${totalAmount.toFixed(2)}</strong></td>
      </tr>
    </table>

    <p style="margin-top:15px;">
      Payment Method: <strong>${paymentDetails?.method || "Cash"}</strong>
    </p>

    ${specialRequests ? `<p><strong>Special Requests:</strong> ${specialRequests}</p>` : ""}
    `
  );
};

// ============================
// CANCELLATION EMAIL
// ============================

const generateCancellationEmail = (booking, cancellationFee, refundAmount) => {
  return baseLayout(
    "Booking Cancelled",
    `
    <p>Dear <strong>${booking.guestDetails.primaryGuest.name}</strong>,</p>
    <p>Your booking <strong>${booking.bookingId}</strong> has been cancelled.</p>

    <table width="100%" cellpadding="6">
      <tr><td>Cancellation Fee</td><td align="right">₹${cancellationFee.toFixed(2)}</td></tr>
      <tr><td>Refund Amount</td><td align="right">₹${refundAmount.toFixed(2)}</td></tr>
    </table>

    <p style="font-size:13px;color:#666;">
      Refunds (if applicable) are processed within 5–7 business days.
    </p>
    `
  );
};

// ============================
// CHECK-IN EMAIL
// ============================

const generateCheckInEmail = (booking, checkInDetails) => {
  return baseLayout(
    "Check-In Confirmed",
    `
    <p>Welcome <strong>${booking.guestDetails.primaryGuest.name}</strong> 👋</p>
    <p>You have successfully checked in.</p>

    <table width="100%" cellpadding="6">
      <tr><td>Room</td><td align="right">${booking.room.name}</td></tr>
      <tr><td>Check-in Time</td><td align="right">${checkInDetails.actualCheckInTime.toLocaleTimeString()}</td></tr>
      <tr><td>Check-out</td><td align="right">${new Date(booking.bookingDates.checkOutDate).toDateString()}</td></tr>
    </table>

    <p><strong>WiFi:</strong> LuxuryHotel_Guest<br/>
    <strong>Password:</strong> Welcome2024</p>

    <p>We wish you a wonderful stay!</p>
    `
  );
};

// ============================
// CHECK-OUT EMAIL
// ============================

const generateCheckOutEmail = (booking, checkOutDetails) => {
  const totalStayAmount = booking.pricing.totalAmount;
  const additionalCharges = checkOutDetails.additionalCharges || [];
  const extra = additionalCharges.reduce((a, b) => a + b.amount, 0);

  return baseLayout(
    "Check-Out Complete",
    `
    <p>Dear <strong>${booking.guestDetails.primaryGuest.name}</strong>,</p>
    <p>Thank you for staying with us.</p>

    <table width="100%" cellpadding="6">
      <tr><td>Stay Amount</td><td align="right">₹${totalStayAmount.toFixed(2)}</td></tr>
      <tr><td>Additional Charges</td><td align="right">₹${extra.toFixed(2)}</td></tr>
      <tr>
        <td><strong>Total</strong></td>
        <td align="right"><strong>₹${(totalStayAmount + extra).toFixed(2)}</strong></td>
      </tr>
    </table>

    <p style="margin-top:15px;">
      Payment Status: <strong>${booking.paymentStatus}</strong><br/>
      Payment Method: <strong>${booking.paymentDetails?.method || "N/A"}</strong>
    </p>

    <p>We hope to welcome you again soon 🌟</p>
    `
  );
};

// ============================
// EXPORTS
// ============================

module.exports = {
  generatePasswordResetEmail,
  generateBookingConfirmationEmail,
  generateCancellationEmail,
  generateCheckInEmail,
  generateCheckOutEmail
};
