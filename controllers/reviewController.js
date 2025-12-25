const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const MenuItem = require('../models/MenuItem');

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
    try {
        const { booking, room, menuItem, rating, title, comment, reviewType } = req.body;
        
        console.log('Creating review with data:', { booking, room, menuItem, rating, title, comment, reviewType });

        // Verify booking belongs to user and is completed
        if (booking) {
            const bookingData = await Booking.findById(booking);
            if (!bookingData || bookingData.user.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to review this booking'
                });
            }

            if (bookingData.status !== 'CheckedOut') {
                return res.status(400).json({
                    success: false,
                    message: 'Can only review completed stays'
                });
            }
        }

        // Check if review already exists
        const existingReview = await Review.findOne({
            user: req.user.id,
            ...(booking && { booking }),
            ...(room && { room }),
            ...(menuItem && { menuItem })
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'Review already exists'
            });
        }

        const review = await Review.create({
            user: req.user.id,
            booking,
            room,
            menuItem,
            rating,
            title,
            comment,
            reviewType
        });

        await review.populate([
            { path: 'user', select: 'name avatar' },
            { path: 'room', select: 'name type' },
            { path: 'menuItem', select: 'name' }
        ]);

        // Update average rating
        if (room) {
            const roomData = await Room.findById(room);
            await roomData.updateAverageRating();
        }

        if (menuItem) {
            const menuItemData = await MenuItem.findById(menuItem);
            await menuItemData.updateAverageRating();
        }

        res.status(201).json({
            success: true,
            data: review
        });

    } catch (error) {
        console.error('Create review error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }
        
        // Handle other errors
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
};

// @desc    Get reviews
// @route   GET /api/reviews
// @access  Public
const getReviews = async (req, res) => {
    try {
        const { room, menuItem, rating, page = 1, limit = 10 } = req.query;
        
        let query = { isApproved: true };

        if (room) query.room = room;
        if (menuItem) query.menuItem = menuItem;
        if (rating) query.rating = { $gte: Number(rating) };

        const skip = (page - 1) * limit;

        const reviews = await Review.find(query)
            .populate('user', 'name avatar')
            .populate('room', 'name type')
            .populate('menuItem', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Review.countDocuments(query);

        res.status(200).json({
            success: true,
            count: reviews.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: reviews
        });

    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get user's reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
const getMyReviews = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const reviews = await Review.find({ user: req.user.id })
            .populate('room', 'name type')
            .populate('menuItem', 'name')
            .populate('booking', 'bookingId')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Review.countDocuments({ user: req.user.id });

        res.status(200).json({
            success: true,
            count: reviews.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: reviews
        });

    } catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = async (req, res) => {
    try {
        let review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if user owns the review
        if (review.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this review'
            });
        }

        review = await Review.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        ).populate([
            { path: 'user', select: 'name avatar' },
            { path: 'room', select: 'name type' },
            { path: 'menuItem', select: 'name' }
        ]);

        // Update average ratings
        if (review.room) {
            const room = await Room.findById(review.room._id);
            await room.updateAverageRating();
        }

        if (review.menuItem) {
            const menuItem = await MenuItem.findById(review.menuItem._id);
            await menuItem.updateAverageRating();
        }

        res.status(200).json({
            success: true,
            data: review
        });

    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if user owns the review or is admin
        if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this review'
            });
        }

        await review.deleteOne();

        // Update average ratings
        if (review.room) {
            const room = await Room.findById(review.room);
            await room.updateAverageRating();
        }

        if (review.menuItem) {
            const menuItem = await MenuItem.findById(review.menuItem);
            await menuItem.updateAverageRating();
        }

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });

    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Approve/Reject review (Admin only)
// @route   PUT /api/reviews/:id/moderate
// @access  Private/Admin
const moderateReview = async (req, res) => {
    try {
        const { isApproved, moderatorNote } = req.body;

        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        review.isApproved = isApproved;
        review.moderatedBy = req.user.id;
        review.moderatedAt = new Date();
        if (moderatorNote) review.moderatorNote = moderatorNote;

        await review.save();

        res.status(200).json({
            success: true,
            data: review
        });

    } catch (error) {
        console.error('Moderate review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get pending reviews (Admin only)
// @route   GET /api/reviews/pending
// @access  Private/Admin
const getPendingReviews = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const reviews = await Review.find({ isApproved: false })
            .populate('user', 'name email')
            .populate('room', 'name type')
            .populate('menuItem', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Review.countDocuments({ isApproved: false });

        res.status(200).json({
            success: true,
            count: reviews.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: reviews
        });

    } catch (error) {
        console.error('Get pending reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    createReview,
    getReviews,
    getMyReviews,
    updateReview,
    deleteReview,
    moderateReview,
    getPendingReviews
};