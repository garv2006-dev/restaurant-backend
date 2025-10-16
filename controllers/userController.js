const User = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const fieldsToUpdate = {
            name: req.body.name,
            phone: req.body.phone,
            address: req.body.address,
            dateOfBirth: req.body.dateOfBirth,
            preferences: req.body.preferences
        };

        // Remove undefined fields
        Object.keys(fieldsToUpdate).forEach(key => {
            if (fieldsToUpdate[key] === undefined) {
                delete fieldsToUpdate[key];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.user.id,
            fieldsToUpdate,
            {
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                success: false,
                message: `User with this ${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Upload user avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload an image'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: req.file.filename },
            { new: true }
        );

        res.status(200).json({
            success: true,
            data: {
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
const getDashboard = async (req, res) => {
    try {
        // Get user statistics
        const totalBookings = await Booking.countDocuments({ user: req.user.id });
        const completedBookings = await Booking.countDocuments({ 
            user: req.user.id, 
            status: 'CheckedOut' 
        });
        const upcomingBookings = await Booking.countDocuments({ 
            user: req.user.id, 
            status: { $in: ['Confirmed', 'CheckedIn'] },
            'bookingDates.checkInDate': { $gte: new Date() }
        });

        // Get total amount spent
        const paymentStats = await Payment.aggregate([
            { $match: { user: req.user._id, status: 'Completed' } },
            { $group: { _id: null, totalSpent: { $sum: '$amount' } } }
        ]);

        const totalSpent = paymentStats.length > 0 ? paymentStats[0].totalSpent : 0;

        // Get recent bookings
        const recentBookings = await Booking.find({ user: req.user.id })
            .populate('room', 'name type images')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get user details
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    name: user.name,
                    email: user.email,
                    loyaltyPoints: user.loyaltyPoints,
                    avatar: user.avatar
                },
                stats: {
                    totalBookings,
                    completedBookings,
                    upcomingBookings,
                    totalSpent
                },
                recentBookings
            }
        });

    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
const updatePreferences = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { preferences: req.body },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: {
                preferences: user.preferences
            }
        });

    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
const deleteAccount = async (req, res) => {
    try {
        // Check if user has any active bookings
        const activeBookings = await Booking.countDocuments({
            user: req.user.id,
            status: { $in: ['Confirmed', 'CheckedIn'] }
        });

        if (activeBookings > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete account with active bookings'
            });
        }

        // Deactivate account instead of deleting
        await User.findByIdAndUpdate(req.user.id, { isActive: false });

        res.status(200).json({
            success: true,
            message: 'Account deactivated successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const { role, isActive, search, page = 1, limit = 20 } = req.query;
        
        let query = {};

        if (role) query.role = role;
        if (isActive !== undefined) query.isActive = isActive === 'true';
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        // Get users with booking statistics
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip)
            .lean(); // Use lean() for better performance

        // Add booking statistics for each user
        const usersWithStats = await Promise.all(users.map(async (user) => {
            // Get booking count
            const totalBookings = await Booking.countDocuments({ user: user._id });
            
            // Get total spent
            const paymentStats = await Payment.aggregate([
                {
                    $match: {
                        user: user._id,
                        status: 'Completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSpent: { $sum: '$amount' }
                    }
                }
            ]);
            
            const totalSpent = paymentStats.length > 0 ? paymentStats[0].totalSpent : 0;
            
            return {
                ...user,
                totalBookings,
                totalSpent
            };
        }));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            count: usersWithStats.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: usersWithStats
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get single user (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user statistics
        const bookingStats = await Booking.aggregate([
            { $match: { user: user._id } },
            { 
                $group: { 
                    _id: '$status', 
                    count: { $sum: 1 },
                    totalSpent: { $sum: '$pricing.totalAmount' }
                } 
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                user,
                bookingStats
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
    try {
        const fieldsToUpdate = {};
        
        // Only allow certain fields to be updated by admin
        const allowedFields = ['name', 'role', 'isActive', 'loyaltyPoints'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                fieldsToUpdate[field] = req.body[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            req.params.id,
            fieldsToUpdate,
            {
                new: true,
                runValidators: true
            }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    uploadAvatar,
    getDashboard,
    updatePreferences,
    deleteAccount,
    getUsers,
    getUser,
    updateUser
};