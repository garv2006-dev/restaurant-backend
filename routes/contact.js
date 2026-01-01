const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../controllers/contactController');
const rateLimit = require('express-rate-limit');

// Rate limiter for contact form to prevent spam
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    success: false,
    message: 'Too many contact form submissions. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/contact
// @desc    Send contact form email
// @access  Public
router.post('/', contactLimiter, sendContactEmail);

module.exports = router;
