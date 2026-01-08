const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../controllers/contactController');
const rateLimit = require('express-rate-limit');

// Rate limiter for contact form to prevent spam
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // development: 50 req/15min, production: 5 req/15min per IP
  message: {
    success: false,
    message: 'Too many contact form submissions. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting entirely in development if needed
  skip: () => process.env.NODE_ENV === 'development' && process.env.DISABLE_CONTACT_RATE_LIMIT === 'true'
});

// @route   POST /api/contact
// @desc    Send contact form email
// @access  Public
router.post('/', contactLimiter, sendContactEmail);

module.exports = router;
