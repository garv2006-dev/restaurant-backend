// Email Templates for Luxury Hotel
// Professional, responsive HTML email templates

const generatePasswordResetEmail = (resetUrl) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            background-color: #ffffff;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 36px;
            font-weight: bold;
            color: #4a90e2;
            letter-spacing: 3px;
            margin-bottom: 20px;
        }
        
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .left-section {
            flex: 1;
            padding-right: 40px;
        }
        
        .right-section {
            flex: 1;
            text-align: right;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .info-row {
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .info-label {
            color: #4a90e2;
            font-weight: normal;
        }
        
        .info-value {
            color: #333;
            font-weight: normal;
        }
        
        .company-info {
            text-align: right;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        
        .company-details {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        
        .content-section {
            background-color: #f8f9fa;
            padding: 30px;
            margin: 30px 0;
            border-left: 4px solid #4a90e2;
        }
        
        .content-section h3 {
            font-size: 16px;
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .content-section p {
            font-size: 14px;
            color: #333;
            margin-bottom: 15px;
            line-height: 1.6;
        }
        
        .reset-button {
            display: inline-block;
            background-color: #4a90e2;
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 20px 0;
        }
        
        .reset-button:hover {
            background-color: #357abd;
        }
        
        .link-section {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 20px;
            margin: 20px 0;
        }
        
        .link-section h4 {
            color: #856404;
            margin-bottom: 10px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .link-section p {
            color: #856404;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .link-text {
            font-size: 12px;
            color: #4a90e2;
            word-break: break-all;
            background-color: #fff;
            padding: 10px;
            border: 1px solid #e9ecef;
        }
        
        .security-section {
            margin-top: 30px;
        }
        
        .security-section h3 {
            font-size: 14px;
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .security-section ul {
            list-style: none;
            padding: 0;
        }
        
        .security-section li {
            font-size: 14px;
            color: #333;
            margin-bottom: 8px;
            padding-left: 15px;
            position: relative;
        }
        
        .security-section li:before {
            content: "•";
            color: #4a90e2;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                padding: 20px;
            }
            
            .info-section {
                flex-direction: column;
            }
            
            .left-section {
                padding-right: 0;
                margin-bottom: 30px;
            }
            
            .right-section {
                text-align: left;
            }
            
            .company-info {
                text-align: left;
            }
            
            .header h1 {
                font-size: 28px;
                letter-spacing: 2px;
            }
            
            .reset-button {
                display: block;
                text-align: center;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>PASSWORD RESET REQUEST</h1>
        </div>
        
        <div class="info-section">
            <div class="left-section">
                <div class="section-title">REQUEST DETAILS</div>
                <div class="info-row">
                    <span class="info-label">Request Date:</span>
                    <span class="info-value">${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Request Time:</span>
                    <span class="info-value">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Expires:</span>
                    <span class="info-value">10 minutes</span>
                </div>
            </div>
            
            <div class="right-section">
                <div class="company-info">
                    <div class="company-name">Luxury Hotel</div>
                    <div class="company-details">
                        123 Luxury Avenue<br>
                        Premium District, NY 10001<br>
                        UNITED STATES<br><br>
                        support@luxuryhotel.com<br>
                        www.luxuryhotel.com
                    </div>
                </div>
            </div>
        </div>
        
        <div class="content-section">
            <h3>RESET YOUR PASSWORD</h3>
            <p>We received a request to reset the password for your Luxury Hotel account. If you made this request, click the button below to create a new password.</p>
            
            <div style="text-align: center;">
                <a href="${resetUrl}" class="reset-button">Reset My Password</a>
            </div>
        </div>
        
        <div class="link-section">
            <h4>ALTERNATIVE ACCESS</h4>
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <div class="link-text">${resetUrl}</div>
        </div>
        
        <div class="security-section">
            <h3>SECURITY INFORMATION</h3>
            <ul>
                <li>This link will expire in 10 minutes for your security</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password won't change until you create a new one</li>
                <li>For security questions, contact our support team</li>
            </ul>
        </div>
    </div>
</body>
</html>
  `;
};

const generateBookingConfirmationEmail = (booking, guestDetails, checkIn, checkOut, nights, roomPrice, subtotal, gst, totalAmount, extraServices, specialRequests, paymentDetails) => {
  // Build extra services HTML for invoice table
  let extraServicesRows = '';
  if (extraServices && extraServices.length > 0) {
    extraServicesRows = extraServices.map(service => `
      <tr>
        <td class="invoice-desc">${service.name}</td>
        <td class="invoice-unit">₹${service.price.toFixed(2)}</td>
        <td class="invoice-qty">${service.quantity}</td>
        <td class="invoice-amount">₹${(service.price * service.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            background-color: #ffffff;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 36px;
            font-weight: bold;
            color: #4a90e2;
            letter-spacing: 3px;
            margin-bottom: 20px;
        }
        
        .booking-info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .left-section {
            flex: 1;
            padding-right: 40px;
        }
        
        .right-section {
            flex: 1;
            text-align: right;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .info-label {
            color: #4a90e2;
            font-weight: normal;
        }
        
        .info-value {
            color: #333;
            font-weight: normal;
        }
        
        .company-info {
            text-align: right;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        
        .company-details {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        
        .booking-details-section {
            margin-bottom: 30px;
        }
        
        .guest-section {
            margin-bottom: 40px;
        }
        
        .invoice-section {
            margin-bottom: 40px;
        }
        
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .invoice-table th {
            background-color: #f8f9fa;
            color: #4a90e2;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            border-bottom: 2px solid #4a90e2;
        }
        
        .invoice-table th:last-child,
        .invoice-table td:last-child {
            text-align: right;
        }
        
        .invoice-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
            color: #333;
        }
        
        .invoice-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        
        .totals-section {
            margin-top: 20px;
            text-align: right;
        }
        
        .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .total-label {
            width: 120px;
            text-align: right;
            margin-right: 20px;
            color: #333;
        }
        
        .total-value {
            width: 100px;
            text-align: right;
            color: #333;
        }
        
        .subtotal-row {
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 10px;
        }
        
        .final-total {
            background-color: #fff3cd;
            padding: 10px;
            margin-top: 10px;
            font-weight: bold;
            font-size: 16px;
            border: 1px solid #ffeaa7;
        }
        
        .additional-info {
            margin-top: 40px;
        }
        
        .additional-info h3 {
            font-size: 14px;
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        
        .additional-info p {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .special-requests {
            margin-top: 30px;
            background-color: #f8f9fa;
            padding: 20px;
            border-left: 4px solid #4a90e2;
        }
        
        .special-requests h3 {
            font-size: 14px;
            font-weight: bold;
            color: #4a90e2;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        
        .special-requests p {
            font-size: 14px;
            color: #333;
            font-style: italic;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                padding: 20px;
            }
            
            .booking-info-section {
                flex-direction: column;
            }
            
            .left-section {
                padding-right: 0;
                margin-bottom: 30px;
            }
            
            .right-section {
                text-align: left;
            }
            
            .company-info {
                text-align: left;
            }
            
            .header h1 {
                font-size: 28px;
                letter-spacing: 2px;
            }
            
            .invoice-table th,
            .invoice-table td {
                padding: 8px 4px;
                font-size: 12px;
            }
            
            .total-row {
                justify-content: space-between;
            }
            
            .total-label {
                width: auto;
                margin-right: 10px;
            }
            
            .total-value {
                width: auto;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>BOOKING CONFIRMATION</h1>
        </div>
        
        <div class="booking-info-section">
            <div class="left-section">
                <div class="section-title">BOOKING #</div>
                <div class="info-row">
                    <span class="info-value">${booking.bookingId}</span>
                </div>
                
                <div class="section-title" style="margin-top: 20px;">BOOKING DATE</div>
                <div class="info-row">
                    <span class="info-value">${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                
                <div class="section-title" style="margin-top: 30px;">BOOKING DETAILS</div>
                <div class="info-row">
                    <span class="info-label">Check in</span>
                    <span class="info-value">${checkIn.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Check out</span>
                    <span class="info-value">${checkOut.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Room type</span>
                    <span class="info-value">${booking.room.type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"># Guests</span>
                    <span class="info-value">${guestDetails.totalAdults + guestDetails.totalChildren}</span>
                </div>
                
                <div class="section-title" style="margin-top: 30px;">BOOKED BY</div>
                <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">${guestDetails.primaryGuest.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Contact</span>
                    <span class="info-value" style="color: #4a90e2; text-decoration: underline;">${guestDetails.primaryGuest.email}</span>
                </div>
            </div>
            
            <div class="right-section">
                <div class="company-info">
                    <div class="company-name">Luxury Hotel</div>
                    <div class="company-details">
                        123 Luxury Avenue<br>
                        Premium District, NY 10001<br>
                        UNITED STATES<br><br>
                        support@luxuryhotel.com<br>
                        www.luxuryhotel.com
                    </div>
                </div>
            </div>
        </div>
            
            <div class="invoice-section">
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>DESCRIPTION</th>
                            <th>UNIT COST</th>
                            <th>QUANTITY</th>
                            <th>AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${booking.room.name} - ${booking.room.type}</td>
                            <td>₹${(roomPrice / nights).toFixed(2)}</td>
                            <td>${nights}</td>
                            <td>₹${roomPrice.toFixed(2)}</td>
                        </tr>
                        ${extraServicesRows}
                    </tbody>
                </table>
                
                <div class="totals-section">
                    <div class="total-row subtotal-row">
                        <span class="total-label">Subtotal</span>
                        <span class="total-value">₹${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span class="total-label">VAT rate (%)</span>
                        <span class="total-value">18%</span>
                    </div>
                    <div class="total-row">
                        <span class="total-label">VAT</span>
                        <span class="total-value">₹${gst.toFixed(2)}</span>
                    </div>
                    <div class="total-row final-total">
                        <span class="total-label">Total</span>
                        <span class="total-value">₹${totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <div class="additional-info">
                <h3>ADDITIONAL INFORMATION</h3>
                <p>Check-in time: 3:00 PM | Check-out time: 11:00 AM</p>
                <p>Payment Method: ${paymentDetails?.method || 'Cash'}</p>
                <p>Valid ID required at check-in. Smoking prohibited in all rooms.</p>
            </div>
            
            ${specialRequests ? `
            <div class="special-requests">
                <h3>SPECIAL REQUESTS</h3>
                <p>${specialRequests}</p>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <div class="footer-content">
                <h3>🏨 Luxury Hotel</h3>
                <p>Premium hospitality experience since 1985</p>
                <p>📍 123 Luxury Avenue, Premium District, New York, NY 10001</p>
                <p>� i2nfo@luxuryhotel.com | 📞 +1 (555) 123-4567</p>
            </div>
            
            <div class="footer-links">
                <a href="#">Manage Booking</a>
                <a href="#">Hotel Amenities</a>
                <a href="#">Contact Us</a>
                <a href="#">Cancellation Policy</a>
            </div>
            
            <div class="copyright">
                <p>&copy; ${new Date().getFullYear()} Luxury Hotel. All rights reserved.</p>
                <p>Thank you for choosing us for your luxury stay experience.</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

const generateCancellationEmail = (booking, cancellationFee, refundAmount) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Cancellation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 36px;
            font-weight: bold;
            color: #dc3545;
            letter-spacing: 3px;
            margin-bottom: 20px;
        }
        
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .left-section {
            flex: 1;
            padding-right: 40px;
        }
        
        .right-section {
            flex: 1;
            text-align: right;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #dc3545;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .info-label {
            color: #dc3545;
            font-weight: normal;
        }
        
        .info-value {
            color: #333;
            font-weight: normal;
        }
        
        .company-info {
            text-align: right;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        
        .company-details {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        
        .refund-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .refund-table th {
            background-color: #f8f9fa;
            color: #dc3545;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            border-bottom: 2px solid #dc3545;
        }
        
        .refund-table th:last-child,
        .refund-table td:last-child {
            text-align: right;
        }
        
        .refund-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
            color: #333;
        }
        
        .totals-section {
            margin-top: 20px;
            text-align: right;
        }
        
        .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .total-label {
            width: 120px;
            text-align: right;
            margin-right: 20px;
            color: #333;
        }
        
        .total-value {
            width: 100px;
            text-align: right;
            color: #333;
        }
        
        .final-total {
            background-color: #f8d7da;
            padding: 10px;
            margin-top: 10px;
            font-weight: bold;
            font-size: 16px;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        
        .refund-info {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            padding: 20px;
            margin: 20px 0;
        }
        
        .refund-info h3 {
            color: #0c5460;
            margin-bottom: 10px;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .refund-info p {
            color: #0c5460;
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .detail-section {
            background-color: #f8f9fa;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 4px solid #dc3545;
        }
        
        .detail-section h3 {
            color: #dc3545;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content, .footer {
                padding: 25px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .detail-item {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .detail-value {
                margin-top: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>❌ Booking Cancelled</h1>
            <p>Your reservation has been cancelled</p>
            <div class="booking-id">Booking ID: ${booking.bookingId}</div>
        </div>
        
        <div class="content">
            <div class="greeting">Dear ${booking.guestDetails.primaryGuest.name},</div>
            
            <div class="cancellation-notice">
                <h2>🚫 Booking Cancellation Confirmed</h2>
                <p>We have successfully processed your booking cancellation request.</p>
            </div>
            
            <div class="details-section">
                <h3>📋 Cancellation Details</h3>
                <div class="detail-item">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">${booking.bookingId}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cancellation Date:</span>
                    <span class="detail-value">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cancellation Fee:</span>
                    <span class="detail-value">₹${cancellationFee.toFixed(2)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Refund Amount:</span>
                    <span class="detail-value">₹${refundAmount.toFixed(2)}</span>
                </div>
            </div>
            
            ${refundAmount > 0 ? `
            <div class="refund-info">
                <h3>💰 Refund Information</h3>
                <p><strong>Refund Amount: ₹${refundAmount.toFixed(2)}</strong></p>
                <p>Your refund will be processed within 5-7 business days.</p>
                <p>The amount will be credited to your original payment method.</p>
            </div>
            ` : `
            <div class="refund-info">
                <h3>ℹ️ Refund Information</h3>
                <p>No refund is applicable for this cancellation due to our cancellation policy.</p>
            </div>
            `}
            
            <div class="contact-info">
                <h3>📞 Need Help?</h3>
                <p>If you have any questions about this cancellation, our support team is here to help.</p>
                <p><strong>Email:</strong> support@luxuryhotel.com</p>
                <p><strong>Phone:</strong> +1 (555) 123-4567</p>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-content">
                <h3>🏨 Luxury Hotel</h3>
                <p>We're sorry to see you go, but we hope to serve you again in the future.</p>
                <p>📧 info@luxuryhotel.com | 📞 +1 (555) 123-4567</p>
            </div>
            
            <div class="footer-links">
                <a href="#">Book Again</a>
                <a href="#">Contact Support</a>
                <a href="#">Cancellation Policy</a>
            </div>
            
            <div class="copyright">
                <p>&copy; ${new Date().getFullYear()} Luxury Hotel. All rights reserved.</p>
                <p>Thank you for considering us for your travel needs.</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

const generateCheckInEmail = (booking, checkInDetails) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Check-In Confirmation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            background-color: #ffffff;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 36px;
            font-weight: bold;
            color: #28a745;
            letter-spacing: 3px;
            margin-bottom: 20px;
        }
        
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .left-section {
            flex: 1;
            padding-right: 40px;
        }
        
        .right-section {
            flex: 1;
            text-align: right;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .info-label {
            color: #28a745;
            font-weight: normal;
        }
        
        .info-value {
            color: #333;
            font-weight: normal;
        }
        
        .company-info {
            text-align: right;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        
        .company-details {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        
        .welcome-section {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        
        .welcome-section h3 {
            color: #155724;
            margin-bottom: 10px;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .welcome-section p {
            color: #155724;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .detail-section {
            background-color: #f8f9fa;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 4px solid #28a745;
        }
        
        .detail-section h3 {
            color: #28a745;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .detail-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .detail-item:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            font-weight: 600;
            color: #495057;
        }
        
        .detail-value {
            color: #333;
            font-weight: 500;
        }
        
        .amenities-section {
            background-color: #e3f2fd;
            border: 1px solid #bbdefb;
            padding: 20px;
            margin: 20px 0;
        }
        
        .amenities-section h3 {
            color: #1565c0;
            margin-bottom: 15px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .amenities-section ul {
            list-style: none;
            padding: 0;
        }
        
        .amenities-section li {
            color: #1565c0;
            font-size: 14px;
            margin-bottom: 8px;
            padding-left: 15px;
            position: relative;
        }
        
        .amenities-section li:before {
            content: "•";
            color: #1565c0;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                padding: 20px;
            }
            
            .info-section {
                flex-direction: column;
            }
            
            .left-section {
                padding-right: 0;
                margin-bottom: 30px;
            }
            
            .right-section {
                text-align: left;
            }
            
            .company-info {
                text-align: left;
            }
            
            .header h1 {
                font-size: 28px;
                letter-spacing: 2px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>CHECK-IN CONFIRMATION</h1>
        </div>
        
        <div class="info-section">
            <div class="left-section">
                <div class="section-title">BOOKING #</div>
                <div class="info-row">
                    <span class="info-value">${booking.bookingId}</span>
                </div>
                
                <div class="section-title" style="margin-top: 20px;">CHECK-IN DATE</div>
                <div class="info-row">
                    <span class="info-value">${checkInDetails.actualCheckInTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                
                <div class="section-title" style="margin-top: 20px;">CHECK-IN TIME</div>
                <div class="info-row">
                    <span class="info-value">${checkInDetails.actualCheckInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div class="section-title" style="margin-top: 30px;">STAY DETAILS</div>
                <div class="info-row">
                    <span class="info-label">Room Type</span>
                    <span class="info-value">${booking.room.type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Room Name</span>
                    <span class="info-value">${booking.room.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Check-out Date</span>
                    <span class="info-value">${new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                
                <div class="section-title" style="margin-top: 30px;">GUEST INFORMATION</div>
                <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">${booking.guestDetails.primaryGuest.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Contact</span>
                    <span class="info-value" style="color: #28a745; text-decoration: underline;">${booking.guestDetails.primaryGuest.email}</span>
                </div>
            </div>
            
            <div class="right-section">
                <div class="company-info">
                    <div class="company-name">Luxury Hotel</div>
                    <div class="company-details">
                        123 Luxury Avenue<br>
                        Premium District, NY 10001<br>
                        UNITED STATES<br><br>
                        support@luxuryhotel.com<br>
                        www.luxuryhotel.com
                    </div>
                </div>
            </div>
        </div>
        
        <div class="welcome-section">
            <h3>WELCOME TO LUXURY HOTEL!</h3>
            <p>You have successfully checked in. We hope you enjoy your stay with us.</p>
            <p>Your room is ready and waiting for you.</p>
        </div>
        
        <div class="detail-section">
            <h3>IMPORTANT INFORMATION</h3>
            <div class="detail-item">
                <span class="detail-label">WiFi Network:</span>
                <span class="detail-value">LuxuryHotel_Guest</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">WiFi Password:</span>
                <span class="detail-value">Welcome2024</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Check-out Time:</span>
                <span class="detail-value">11:00 AM</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Concierge:</span>
                <span class="detail-value">Dial 0 from your room</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Room Service:</span>
                <span class="detail-value">Available 24/7 - Dial 1</span>
            </div>
        </div>
        
        <div class="amenities-section">
            <h3>HOTEL AMENITIES</h3>
            <ul>
                <li>Complimentary WiFi throughout the hotel</li>
                <li>24/7 Room Service and Concierge</li>
                <li>Fitness Center (6:00 AM - 10:00 PM)</li>
                <li>Swimming Pool (6:00 AM - 9:00 PM)</li>
                <li>Business Center and Meeting Rooms</li>
                <li>Spa and Wellness Center</li>
                <li>Restaurant and Bar</li>
                <li>Valet Parking Available</li>
            </ul>
        </div>
        
        <div class="detail-section">
            <h3>NEED ASSISTANCE?</h3>
            <p>Our staff is available 24/7 to ensure your stay is comfortable and memorable.</p>
            <p><strong>Front Desk:</strong> +1 (555) 123-4567</p>
            <p><strong>Concierge:</strong> concierge@luxuryhotel.com</p>
            <p><strong>Emergency:</strong> Dial 911 or contact Front Desk</p>
        </div>
    </div>
</body>
</html>
  `;
};

const generateCheckOutEmail = (booking, checkOutDetails) => {
  const totalStayAmount = booking.pricing.totalAmount;
  const additionalCharges = checkOutDetails.additionalCharges || [];
  const additionalTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const finalTotal = totalStayAmount + additionalTotal;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Check-Out Confirmation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            background-color: #ffffff;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 36px;
            font-weight: bold;
            color: #6f42c1;
            letter-spacing: 3px;
            margin-bottom: 20px;
        }
        
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        
        .left-section {
            flex: 1;
            padding-right: 40px;
        }
        
        .right-section {
            flex: 1;
            text-align: right;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #6f42c1;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .info-label {
            color: #6f42c1;
            font-weight: normal;
        }
        
        .info-value {
            color: #333;
            font-weight: normal;
        }
        
        .company-info {
            text-align: right;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
        }
        
        .company-details {
            font-size: 14px;
            color: #666;
            line-height: 1.5;
        }
        
        .thank-you-section {
            background-color: #f3e5f5;
            border: 1px solid #e1bee7;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        
        .thank-you-section h3 {
            color: #4a148c;
            margin-bottom: 10px;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .thank-you-section p {
            color: #4a148c;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .final-bill-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .final-bill-table th {
            background-color: #f8f9fa;
            color: #6f42c1;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            border-bottom: 2px solid #6f42c1;
        }
        
        .final-bill-table th:last-child,
        .final-bill-table td:last-child {
            text-align: right;
        }
        
        .final-bill-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
            color: #333;
        }
        
        .final-bill-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        
        .totals-section {
            margin-top: 20px;
            text-align: right;
        }
        
        .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .total-label {
            width: 120px;
            text-align: right;
            margin-right: 20px;
            color: #333;
        }
        
        .total-value {
            width: 100px;
            text-align: right;
            color: #333;
        }
        
        .final-total {
            background-color: #f3e5f5;
            padding: 10px;
            margin-top: 10px;
            font-weight: bold;
            font-size: 16px;
            border: 1px solid #e1bee7;
            color: #4a148c;
        }
        
        .detail-section {
            background-color: #f8f9fa;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 4px solid #6f42c1;
        }
        
        .detail-section h3 {
            color: #6f42c1;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        
        .feedback-section {
            background-color: #e8f5e8;
            border: 1px solid #c8e6c9;
            padding: 20px;
            margin: 20px 0;
        }
        
        .feedback-section h3 {
            color: #2e7d32;
            margin-bottom: 10px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .feedback-section p {
            color: #2e7d32;
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                padding: 20px;
            }
            
            .info-section {
                flex-direction: column;
            }
            
            .left-section {
                padding-right: 0;
                margin-bottom: 30px;
            }
            
            .right-section {
                text-align: left;
            }
            
            .company-info {
                text-align: left;
            }
            
            .header h1 {
                font-size: 28px;
                letter-spacing: 2px;
            }
            
            .final-bill-table th,
            .final-bill-table td {
                padding: 8px 4px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>CHECK-OUT CONFIRMATION</h1>
        </div>
        
        <div class="info-section">
            <div class="left-section">
                <div class="section-title">BOOKING #</div>
                <div class="info-row">
                    <span class="info-value">${booking.bookingId}</span>
                </div>
                
                <div class="section-title" style="margin-top: 20px;">CHECK-OUT DATE</div>
                <div class="info-row">
                    <span class="info-value">${checkOutDetails.actualCheckOutTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                </div>
                
                <div class="section-title" style="margin-top: 20px;">CHECK-OUT TIME</div>
                <div class="info-row">
                    <span class="info-value">${checkOutDetails.actualCheckOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div class="section-title" style="margin-top: 30px;">STAY SUMMARY</div>
                <div class="info-row">
                    <span class="info-label">Room Type</span>
                    <span class="info-value">${booking.room.type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Room Name</span>
                    <span class="info-value">${booking.room.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total Nights</span>
                    <span class="info-value">${booking.bookingDates.nights}</span>
                </div>
                
                <div class="section-title" style="margin-top: 30px;">GUEST INFORMATION</div>
                <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">${booking.guestDetails.primaryGuest.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Contact</span>
                    <span class="info-value" style="color: #6f42c1; text-decoration: underline;">${booking.guestDetails.primaryGuest.email}</span>
                </div>
            </div>
            
            <div class="right-section">
                <div class="company-info">
                    <div class="company-name">Luxury Hotel</div>
                    <div class="company-details">
                        123 Luxury Avenue<br>
                        Premium District, NY 10001<br>
                        UNITED STATES<br><br>
                        support@luxuryhotel.com<br>
                        www.luxuryhotel.com
                    </div>
                </div>
            </div>
        </div>
        
        <div class="thank-you-section">
            <h3>THANK YOU FOR STAYING WITH US!</h3>
            <p>We hope you enjoyed your stay at Luxury Hotel.</p>
            <p>Your check-out has been processed successfully.</p>
        </div>
        
        ${additionalCharges.length > 0 ? `
        <table class="final-bill-table">
            <thead>
                <tr>
                    <th>ADDITIONAL CHARGES</th>
                    <th>DESCRIPTION</th>
                    <th>AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                ${additionalCharges.map(charge => `
                <tr>
                    <td>${charge.type}</td>
                    <td>${charge.description}</td>
                    <td>₹${charge.amount.toFixed(2)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
        
        <div class="totals-section">
            <div class="total-row">
                <span class="total-label">Original Stay Amount</span>
                <span class="total-value">₹${totalStayAmount.toFixed(2)}</span>
            </div>
            ${additionalTotal > 0 ? `
            <div class="total-row">
                <span class="total-label">Additional Charges</span>
                <span class="total-value">₹${additionalTotal.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row final-total">
                <span class="total-label">Final Total</span>
                <span class="total-value">₹${finalTotal.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>RECEIPT INFORMATION</h3>
            <p>This email serves as your official check-out receipt.</p>
            <p><strong>Payment Status:</strong> ${booking.paymentStatus}</p>
            <p><strong>Payment Method:</strong> ${booking.paymentDetails?.method || 'N/A'}</p>
            <p>For any billing inquiries, please contact our accounting department.</p>
        </div>
        
        <div class="feedback-section">
            <h3>WE VALUE YOUR FEEDBACK</h3>
            <p>Please take a moment to share your experience with us.</p>
            <p><strong>Review us on:</strong> Google, TripAdvisor, or our website</p>
            <p><strong>Email feedback:</strong> feedback@luxuryhotel.com</p>
            <p>Your feedback helps us improve our services for future guests.</p>
        </div>
        
        <div class="detail-section">
            <h3>CONTACT INFORMATION</h3>
            <p>Thank you for choosing Luxury Hotel. We look forward to welcoming you back!</p>
            <p><strong>Reservations:</strong> +1 (555) 123-4567</p>
            <p><strong>Email:</strong> info@luxuryhotel.com</p>
            <p><strong>Website:</strong> www.luxuryhotel.com</p>
        </div>
    </div>
</body>
</html>
  `;
};

module.exports = {
  generatePasswordResetEmail,
  generateBookingConfirmationEmail,
  generateCancellationEmail,
  generateCheckInEmail,
  generateCheckOutEmail
};