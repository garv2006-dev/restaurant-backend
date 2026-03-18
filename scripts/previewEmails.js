const fs = require('fs');
const path = require('path');
const {
    generateBookingConfirmationEmail,
    generateCancellationEmail,
    generateCheckInEmail,
    generateCheckOutEmail,
    generateOTPEmail,
    generateOfflineBookingEmail
} = require('../utils/emailTemplates');

const outputDir = path.join(__dirname, 'test-output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const mockBooking = {
    bookingId: 'BKMLBVWJRRZA7SE',
    guestDetails: {
        primaryGuest: { name: 'Garv variya' },
        totalAdults: 1,
        totalChildren: 0
    },
    rooms: [{ roomType: { name: 'Royal Executive Suite' }, roomNumberInfo: { number: '101' } }],
    bookingDates: {
        checkInDate: '2026-02-09T14:00:00Z',
        checkOutDate: '2026-02-10T11:00:00Z'
    },
    pricing: {
        totalAmount: 9204.00
    }
};

const templates = [
    { name: 'booking-confirmed.html', content: generateBookingConfirmationEmail(mockBooking) },
    { name: 'booking-cancelled.html', content: generateCancellationEmail(mockBooking, 0, 4130.00) },
    { name: 'check-in-confirmed.html', content: generateCheckInEmail(mockBooking) },
    { name: 'thank-you.html', content: generateCheckOutEmail(mockBooking) },
    { name: 'otp-verification.html', content: generateOTPEmail('123456', 'Garv variya') },
    { name: 'offline-booking-confirmed.html', content: generateOfflineBookingEmail({
        ...mockBooking,
        status: 'Confirmed',
        rooms: [{ roomType: { name: 'Royal Executive Suite' }, roomNumberInfo: { number: '101' } }]
    }) }
];

templates.forEach(t => {
    fs.writeFileSync(path.join(outputDir, t.name), t.content);
    console.log(`Generated: ${t.name}`);
});

console.log(`\nPreviews generated in: ${outputDir}`);
