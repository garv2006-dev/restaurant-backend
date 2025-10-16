const { body } = require('express-validator');
const {
    register,
    login,
    logout,
    getMe,
    forgotPassword,
    resetPassword,
    updatePassword,
    verifyEmail,
    resendVerification
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const express = require('express');
const router = express.Router();

// Register validation rules
const registerValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('phone')
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Login validation rules
const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Password validation rules
const passwordValidation = [
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Update password validation
const updatePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    ...passwordValidation
];

// Forgot password validation
const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email')
];

// Reset password validation
const resetPasswordValidation = [
    ...passwordValidation,
    body('token')
        .notEmpty()
        .withMessage('Reset token is required')
];

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registerValidation, validateRequest, register);

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', loginValidation, validateRequest, login);

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', logout);

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, getMe);

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
router.put('/updatepassword', protect, updatePasswordValidation, validateRequest, updatePassword);

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
router.post('/forgotpassword', forgotPasswordValidation, validateRequest, forgotPassword);

// @desc    Reset password
// @route   PUT /api/auth/resetpassword
// @access  Public
router.put('/resetpassword', resetPasswordValidation, validateRequest, resetPassword);

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
router.get('/verify/:token', verifyEmail);

// @desc    Resend email verification
// @route   POST /api/auth/resend-verification
// @access  Public
router.post('/resend-verification', forgotPasswordValidation, validateRequest, resendVerification);

module.exports = router;