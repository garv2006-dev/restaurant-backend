const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const register = async (req, res, next) => {
    try {
        const { name, email, phone, password } = req.body;
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });
        if (existingUser) {
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
        const token = user.getSignedJwtToken();
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isEmailVerified: user.isEmailVerified
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
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'There is no user with that email'
            });
        }
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });
        res.status(200).json({
            success: true,
            message: 'Password reset token generated',
            resetToken
        });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.body.token)
            .digest('hex');
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
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
        const verificationToken = user.getEmailVerificationToken();
        await user.save({ validateBeforeSave: false });
        res.status(200).json({
            success: true,
            message: 'Verification email sent',
            verificationToken
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
    getMe,
    forgotPassword,
    resetPassword,
    updatePassword,
    verifyEmail,
    resendVerification,
    socialLogin,
    googleLogin
};