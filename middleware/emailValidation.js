const { body, validationResult } = require('express-validator');

/**
 * Middleware to validate email format before processing.
 * Prevents unnecessary API calls to Resend for invalid addresses.
 */
const validateEmail = [
  body('email', 'Please provide a valid email address.')
    .isEmail()
    .normalizeEmail(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array().map(err => err.msg) 
      });
    }
    next();
  }
];

module.exports = { validateEmail };
