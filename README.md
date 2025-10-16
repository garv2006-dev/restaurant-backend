# Restaurant Booking System - Backend API

## Overview
This is the backend API for the Restaurant Room Booking and Management System built with Node.js, Express.js, and MongoDB.

## Features Implemented
- ✅ JWT-based Authentication & Authorization
- ✅ User Registration & Login
- ✅ Password Reset & Email Verification
- ✅ MongoDB Database Models (User, Room, Booking, Payment, Review, MenuItem)
- ✅ Error Handling & Validation
- ✅ Security Middleware (Helmet, CORS, Rate Limiting)
- ⏳ Room Management APIs (In Progress)
- ⏳ Booking System APIs (In Progress)
- ⏳ Payment Gateway Integration (In Progress)
- ⏳ File Upload for Images (In Progress)
- ⏳ Admin Dashboard APIs (In Progress)

## Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation & Setup

1. **Clone the repository** (if not already done):
```bash
git clone https://github.com/your-username/restaurant-booking-system.git
cd restaurant-booking-system/backend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Environment Configuration**:
Copy `.env.example` to `.env` and update the values:
```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: A strong secret key for JWT tokens
- `EMAIL_USER`: Your Gmail/email service username
- `EMAIL_PASS`: Your app password (for Gmail, generate app-specific password)

4. **Start MongoDB**:
Make sure MongoDB is running on your system.

5. **Run the development server**:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/updatepassword` - Update password
- `POST /api/auth/forgotpassword` - Request password reset
- `PUT /api/auth/resetpassword` - Reset password with token
- `GET /api/auth/verify/:token` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email

### Health Check
- `GET /health` - Server health status

## Database Models

### User Model
- User authentication and profile management
- Role-based access control (customer, staff, admin)
- Loyalty points system
- Email and phone verification

### Room Model
- Different room types (Standard, Deluxe, Suite)
- Pricing with seasonal variations
- Amenities and features
- Availability management
- Rating system integration

### Booking Model
- Complete booking lifecycle management
- Guest details and preferences
- Pricing calculations with taxes and discounts
- Payment integration
- Cancellation policies

### MenuItem Model
- Restaurant menu management
- Dietary information and allergens
- Availability scheduling
- Rating and popularity tracking

### Review Model
- Customer feedback system
- Detailed ratings for different aspects
- Admin response capability
- Helpful vote system

### Payment Model
- Multiple payment gateway support
- Refund management
- Transaction tracking
- Revenue analytics

## Security Features
- JWT token authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation and sanitization
- XSS protection

## Development Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Error Handling
The API uses a consistent error response format:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [/* Detailed validation errors if applicable */]
}
```

## Success Response Format
```json
{
  "success": true,
  "data": {/* Response data */},
  "message": "Optional success message"
}
```

## Logging
- Development: Detailed logs with Morgan
- Production: Combined logs for monitoring
- Error logging for debugging

## Next Steps (TODO)
1. Complete all CRUD operations for rooms, bookings, menu items
2. Implement file upload for images
3. Add payment gateway integration (Stripe/Razorpay)
4. Create comprehensive admin dashboard APIs
5. Add real-time notifications
6. Implement caching with Redis
7. Add API rate limiting per user
8. Complete test coverage
9. Add API documentation with Swagger
10. Set up automated database backups

## Contributing
1. Create feature branches from `main`
2. Follow consistent code formatting
3. Add tests for new features
4. Update documentation
5. Create pull requests for review

## Support
For issues and questions, please create a GitHub issue or contact the development team.