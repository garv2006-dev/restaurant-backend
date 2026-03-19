const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../controllers/contactController');
const { contactLimiter } = require('../middleware/rateLimit');

// @route   POST /api/contact
// @desc    Send contact form email
// @access  Public
router.post('/', contactLimiter, sendContactEmail);

module.exports = router;
