const rateLimit = require('express-rate-limit');

// Environment flag
const isDev = (process.env.NODE_ENV || 'development') === 'development';

/**
 * General API Limiter
 * Broad protection for all API endpoints
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 1000000 : 3000, // production: 3000 req/15min per IP
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
});

/**
 * Authentication Limiter
 * Specific for login, registration, and other shared-IP sensitive routes
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 1000 : 100, // 100 req/15min per IP
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev || process.env.DISABLE_AUTH_RATE_LIMIT === 'true'
});

/**
 * Forgot Password & Verification Limiter
 * FAIR LIMITING: Uses a combination of IP + Email as the key.
 * This prevents multiple users on the same WiFi/Network from blocking each other.
 */
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 10, // 10 requests per hour per (IP + Email) combination
    keyGenerator: (req) => {
        // Use combination of IP and Email to ensure fairness for shared networks
        const email = req.body.email ? req.body.email.toLowerCase().trim() : 'unknown';
        return `${req.ip}_${email}`;
    },
    message: {
        success: false,
        message: 'Too many password reset requests for this account. Please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev
});

/**
 * Contact Form Limiter
 * Prevents spam on contact submissions
 */
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 50 : 5, // production: 5 req/15min per IP
    message: {
        success: false,
        message: 'Too many contact form submissions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev && process.env.DISABLE_CONTACT_RATE_LIMIT === 'true'
});

module.exports = {
    generalLimiter,
    authLimiter,
    forgotPasswordLimiter,
    contactLimiter
};
