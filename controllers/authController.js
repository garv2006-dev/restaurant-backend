const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const sendEmail = require('../utils/sendEmail');
const emailService = require('../services/emailService');
const { generatePasswordResetEmail, generateOTPEmail } = require('../utils/emailTemplates');
const { sendFirstTimeDiscountNotification } = require('../services/firstTimeUserService');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const register = async (req, res, next) => {
    try {
        const { name, email, phone, password } = req.body;
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });
        if (existingUser) {
            // Check if user exists but is not verified
            if (!existingUser.isEmailVerified && existingUser.role === 'customer') {
                // Generate new OTP
                const otp = existingUser.getRegistrationOtp();
                console.log("✅ REGISTRATION OTP (Existing User):", otp); // Log for debugging

                await existingUser.save({ validateBeforeSave: false });

                // Send OTP via email
                const message = `
                Welcome back!
                
                Your verification code is: ${otp}
                
                This code will expire in 3 minutes.
                `;

                const htmlMessage = generateOTPEmail(otp, existingUser.name);

                // Send OTP via email (Non-blocking)
                emailService.sendOTP(existingUser.email, otp, existingUser.name)
                    .catch(err => console.error('Error sending existing user verification:', err));

                return res.status(200).json({
                    success: true,
                    message: 'Account exists but not verified. Verification code resent.',
                    user: {
                        id: existingUser._id,
                        name: existingUser.name,
                        email: existingUser.email
                    }
                });
            }

            return res.status(400).json({
                success: false,
                message: 'User with this email or phone already exists'
            });
        }
        const user = await User.create({
            name,
            email,
            phone,
            password,
            authProvider: 'local'
        });

        // Send first-time discount notification for new users (non-blocking)
        if (user.role === 'customer') {
            sendFirstTimeDiscountNotification(user._id.toString())
                .then(result => {
                    if (result.success) {
                        console.log(`First-time discount sent to new user ${user._id}`);
                    }
                })
                .catch(err => {
                    console.error('Error sending first-time discount:', err);
                });
        }


        // Generate registration OTP
        const otp = user.getRegistrationOtp();
        console.log("✅ REGISTRATION OTP (New User):", otp); // Log for debugging

        await user.save({ validateBeforeSave: false });

        // Send OTP via email
        const message = `
        Thank you for registering!
        
        Your verification code is: ${otp}
        
        This code will expire in 3 minutes.
        `;

        const htmlMessage = generateOTPEmail(otp, user.name);

        // Send OTP via email (Non-blocking)
        emailService.sendOTP(user.email, otp, user.name)
            .catch(err => console.error('Error sending registration email:', err));

        res.status(200).json({
            success: true,
            message: 'Registration successful. Verification code sent to email.',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        next(error);
    }
};

const verifyAccount = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and verification code'
            });
        }

        const emailVerificationToken = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        const user = await User.findOne({
            email,
            emailVerificationToken,
            emailVerificationExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        // Reset rate limiting on successful verification
        user.otpResendAttempts = 0;
        user.otpLockUntil = null;
        await user.save();

        // Send first-time discount notification for new users (if applicable)
        if (user.role === 'customer') {
            sendFirstTimeDiscountNotification(user._id.toString())
                .then(result => {
                    if (result.success) {
                        console.log(`First-time discount sent to new user ${user._id}`);
                    }
                })
                .catch(err => {
                    console.error('Error sending first-time discount:', err);
                });
        }

        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                avatar: user.avatar
            }
        });
    } catch (error) {
        next(error);
    }
};

const googleLogin = async (req, res, next) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken missing' });

    try {
        // Verify token with Google
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        // payload contains email, name, sub (google id), picture, etc.
        const { sub: googleId, email, name, picture } = payload;

        const existingUser = await User.findOne({
            email
        });

        if (existingUser) {
            // Update last login
            existingUser.lastLogin = Date.now();
            await existingUser.save({ validateBeforeSave: false });

            const token = existingUser.getSignedJwtToken();
            res.status(201).json({
                success: true,
                token,
                user: existingUser
            });
        } else {
            const createdUser = await User.create({
                name,
                email,
                phone: null,
                password: "Test@123",
                authProvider: 'google',
                avatar: picture,
                isEmailVerified: true,
                role: 'customer'
            });

            const user = await User.findOne({
                email: createdUser?.email
            });

            // Send first-time discount notification for new Google users (non-blocking)
            if (user && user.role === 'customer' && !user.firstLoginDiscountSent) {
                sendFirstTimeDiscountNotification(user._id.toString())
                    .then(result => {
                        if (result.success) {
                            console.log(`First-time discount sent to new Google user ${user._id}`);
                        }
                    })
                    .catch(err => {
                        console.error('Error sending first-time discount:', err);
                    });
            }

            const token = user.getSignedJwtToken();
            res.status(201).json({
                success: true,
                token,
                user
            });
        }
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }
        // Send first-time discount notification ONLY for new users (non-blocking)
        // This runs asynchronously and doesn't block the login response
        if (user.role === 'customer' && !user.firstLoginDiscountSent) {
            sendFirstTimeDiscountNotification(user._id.toString())
                .then(result => {
                    if (result.success) {
                        console.log(`First-time discount sent to new user ${user._id}`);
                    }
                })
                .catch(err => {
                    console.error('Error sending first-time discount:', err);
                });
        }

        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });

        const token = user.getSignedJwtToken();
        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                avatar: user.avatar,
                loyaltyPoints: user.loyaltyPoints,
                loyaltyTier: user.loyaltyTier
            }
        });
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};

const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

const forgotPassword = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        console.log("✅ USER IN FORGOT PASSWORD HANDLER", user)
        // Always return generic message for security
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If the email exists in our system, a verification code has been sent'
            });
        }

        // Rate Limiting Check
        if (user.otpLockUntil && user.otpLockUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.otpLockUntil - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                message: `Too many attempts. Please wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before trying again.`
            });
        }

        // Check attempts
        if (user.otpResendAttempts >= 3) {
            // Lock for 30 minutes
            user.otpLockUntil = Date.now() + 30 * 60 * 1000;
            user.otpResendAttempts = 0;
            await user.save({ validateBeforeSave: false });

            return res.status(429).json({
                success: false,
                message: 'Maximum attempts reached. Please wait 30 minutes.'
            });
        }

        // Increment attempts
        user.otpResendAttempts += 1;
        // If this is the first attempt in a while (e.g., lock expired), ensure lock is null
        if (user.otpLockUntil && user.otpLockUntil <= Date.now()) {
            user.otpLockUntil = null;
        }

        // Generate reset token (OTP)
        const resetToken = user.getResetPasswordToken();

        console.log("✅ RESET TOKEN (OTP)", resetToken);

        await user.save({ validateBeforeSave: false });

        // Email message
        const message = `
You are receiving this email because you requested to reset your password.

Your verification code is: ${resetToken}

This code will expire in 3 minutes.

If you did not request this, please ignore this email.
        `;

        console.log("✅ MESSAGE", message);

        // Simple HTML for OTP
        const htmlMessage = generateOTPEmail(resetToken, user.name);

        try {
            await emailService.sendOTP(user.email, resetToken, user.name);
            
            res.status(200).json({
                success: true,
                message: 'Verification code sent to email'
            });
        } catch (error) {
            console.log("❌ GET ERROR", error)

            // Clear reset token if email sending fails
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });

            console.error('Email sending error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error sending verification code'
            });
        }
    } catch (error) {
        next(error);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and verification code'
            });
        }

        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        // Find user by email AND valid token
        // Use filtered query to ensure we find the right user
        const user = await User.findOne({
            email: email,
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        // OTP is valid
        // OTP is valid

        // Generate reset link
        const resetToken = user.resetPasswordToken; // Still valid and stored
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        // We use the same generic mechanism but we pass the email and the otp (which is what we verified)
        // Wait, resetPasswordToken is HASHED. We need the original OTP.
        // The original OTP was passed in the request body as `otp`.
        const resetUrl = `${frontendUrl}/reset-password?email=${user.email}&otp=${otp}`;

        const message = `
You have successfully verified your identity.

Click the following link to secure reset your password:
${resetUrl}

This link will expire soon.

If you did not request this, please contact support immediately.
        `;

        const htmlMessage = generatePasswordResetEmail(resetUrl);

        try {
            await emailService.sendPasswordReset(user.email, resetUrl);
        } catch (emailError) {
            console.error("Failed to send reset link email", emailError);
            // We still return success because OTP is valid, but maybe warn?
            // Actually, if this fails, the user can't get the link if they rely on it.
            // But they can likely proceed in the UI if we handle it there too.
        }

        res.status(200).json({
            success: true,
            message: 'Verification successful. A reset link has been sent to your email.'
        });

    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, password } = req.body;

        if (!email || !otp || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all details'
            });
        }

        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        const user = await User.findOne({
            email,
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        // Reset rate limiting on successful password reset
        user.otpResendAttempts = 0;
        user.otpLockUntil = null;

        await user.save();

        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                avatar: user.avatar
            }
        });
    } catch (error) {
        next(error);
    }
};

const updatePassword = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('+password');
        if (!(await user.matchPassword(req.body.currentPassword))) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        user.password = req.body.password;
        await user.save();
        const token = user.getSignedJwtToken();
        res.status(200).json({
            success: true,
            token
        });
    } catch (error) {
        next(error);
    }
};

const verifyEmail = async (req, res, next) => {
    try {
        const emailVerificationToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');
        const user = await User.findOne({
            emailVerificationToken,
            emailVerificationExpire: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save({ validateBeforeSave: false });
        res.status(200).json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        next(error);
    }
};

const resendVerification = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'There is no user with that email'
            });
        }
        if (user.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        // Rate Limiting Check
        if (user.otpLockUntil && user.otpLockUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.otpLockUntil - Date.now()) / 60000);
            return res.status(429).json({
                success: false,
                message: `Too many attempts. Please wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before trying again.`
            });
        }

        // Check attempts
        if (user.otpResendAttempts >= 3) {
            // Lock for 30 minutes
            user.otpLockUntil = Date.now() + 30 * 60 * 1000;
            // We can optionally reset attempts here or keep them as is until lock expires.
            // Following the pattern in forgotPassword:
            user.otpResendAttempts = 0;
            await user.save({ validateBeforeSave: false });

            return res.status(429).json({
                success: false,
                message: 'Maximum attempts reached. Please wait 30 minutes.'
            });
        }

        // Increment attempts
        user.otpResendAttempts += 1;
        // If this is the first attempt in a while (e.g., lock expired), ensure lock is null
        if (user.otpLockUntil && user.otpLockUntil <= Date.now()) {
            user.otpLockUntil = null;
        }
        const otp = user.getRegistrationOtp();
        await user.save({ validateBeforeSave: false });

        const message = `
        Your new verification code is: ${otp}
        
        This code will expire in 3 minutes.
        `;

        const htmlMessage = generateOTPEmail(otp, user.name);

        // Send (Non-blocking)
        emailService.sendOTP(user.email, otp, user.name)
            .catch(err => console.error('Error sending resend verification:', err));

        res.status(200).json({
            success: true,
            message: 'Verification email sent'
        });
    } catch (error) {
        next(error);
    }
};

const socialLogin = async (req, res, next) => {
    try {
        // This function is deprecated since we removed Firebase
        // Use googleLogin instead for Google OAuth
        return res.status(503).json({
            success: false,
            message: 'Social login is no longer available. Please use Google login instead.'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    forgotPassword,
    verifyOtp,
    resetPassword,
    updatePassword,
    verifyEmail,
    resendVerification,
    socialLogin,
    googleLogin,
    getMe,
    verifyAccount
};