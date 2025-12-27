const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Review must belong to a user']
    },
    booking: {
        type: mongoose.Schema.ObjectId,
        ref: 'Booking',
        required: [true, 'Review must be associated with a booking']
    },
    room: {
        type: mongoose.Schema.ObjectId,
        ref: 'Room'
    },
    reviewType: {
        type: String,
        enum: ['room', 'service', 'overall'],
        required: true
    },
    rating: {
        type: Number,
        required: [true, 'Please add a rating between 1 and 5'],
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: [true, 'Please add a review title'],
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    comment: {
        type: String,
        required: [true, 'Please add a comment'],
        maxlength: [1000, 'Comment cannot be more than 1000 characters']
    },
    detailedRatings: {
        cleanliness: {
            type: Number,
            min: 1,
            max: 5
        },
        comfort: {
            type: Number,
            min: 1,
            max: 5
        },
        service: {
            type: Number,
            min: 1,
            max: 5
        },
        value: {
            type: Number,
            min: 1,
            max: 5
        },
        location: {
            type: Number,
            min: 1,
            max: 5
        },
        amenities: {
            type: Number,
            min: 1,
            max: 5
        }
    },
    pros: [String],
    cons: [String],
    images: [{
        url: {
            type: String,
            required: true
        },
        caption: String
    }],
    isApproved: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isRecommended: {
        type: Boolean,
        default: false
    },
    visitType: {
        type: String,
        enum: ['Business', 'Leisure', 'Family', 'Couple', 'Solo', 'Group']
    },
    stayDuration: String, // e.g., "2 nights", "1 week"
    roomType: String,
    traveledWith: String,
    adminResponse: {
        response: String,
        respondedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        respondedAt: Date
    },
    helpfulVotes: {
        helpful: {
            type: Number,
            default: 0
        },
        notHelpful: {
            type: Number,
            default: 0
        },
        votedBy: [{
            user: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            vote: {
                type: String,
                enum: ['helpful', 'notHelpful']
            }
        }]
    },
    flags: {
        isReported: {
            type: Boolean,
            default: false
        },
        reports: [{
            reportedBy: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            },
            reason: {
                type: String,
                enum: ['spam', 'inappropriate', 'fake', 'offensive', 'other']
            },
            details: String,
            reportedAt: {
                type: Date,
                default: Date.now
            }
        }],
        isHidden: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Compound indexes
ReviewSchema.index({ user: 1, booking: 1 }, { unique: true }); // One review per user per booking
ReviewSchema.index({ room: 1, isApproved: 1 });
ReviewSchema.index({ rating: -1 });
ReviewSchema.index({ createdAt: -1 });
ReviewSchema.index({ reviewType: 1 });

// Validation: Room must be specified
ReviewSchema.pre('save', function(next) {
    if (!this.room) {
        return next(new Error('Room is required'));
    }
    
    next();
});

// Method to calculate helpful percentage
ReviewSchema.methods.getHelpfulPercentage = function() {
    const totalVotes = this.helpfulVotes.helpful + this.helpfulVotes.notHelpful;
    if (totalVotes === 0) return 0;
    return Math.round((this.helpfulVotes.helpful / totalVotes) * 100);
};

// Method to add a helpful vote
ReviewSchema.methods.addHelpfulVote = function(userId, vote) {
    // Remove existing vote from this user
    this.helpfulVotes.votedBy = this.helpfulVotes.votedBy.filter(
        v => v.user.toString() !== userId.toString()
    );
    
    // Add new vote
    this.helpfulVotes.votedBy.push({ user: userId, vote });
    
    // Recalculate vote counts
    this.helpfulVotes.helpful = this.helpfulVotes.votedBy.filter(v => v.vote === 'helpful').length;
    this.helpfulVotes.notHelpful = this.helpfulVotes.votedBy.filter(v => v.vote === 'notHelpful').length;
    
    return this.save();
};

// Method to flag/report review
ReviewSchema.methods.reportReview = function(userId, reason, details) {
    this.flags.reports.push({
        reportedBy: userId,
        reason,
        details
    });
    
    this.flags.isReported = true;
    
    return this.save();
};

// Static method to get average ratings for a room
ReviewSchema.statics.getAverageRating = async function(roomId) {
    const stats = await this.aggregate([
        {
            $match: {
                room: roomId,
                isApproved: true,
                'flags.isHidden': false
            }
        },
        {
            $group: {
                _id: '$room',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                averageCleanliness: { $avg: '$detailedRatings.cleanliness' },
                averageComfort: { $avg: '$detailedRatings.comfort' },
                averageService: { $avg: '$detailedRatings.service' },
                averageValue: { $avg: '$detailedRatings.value' },
                averageLocation: { $avg: '$detailedRatings.location' },
                averageAmenities: { $avg: '$detailedRatings.amenities' }
            }
        }
    ]);
    
    return stats[0] || {
        averageRating: 0,
        totalReviews: 0
    };
};

// Static method to get reviews with filters
ReviewSchema.statics.getFilteredReviews = function(filters = {}) {
    let query = { isApproved: true, 'flags.isHidden': false };
    
    if (filters.room) query.room = filters.room;
    if (filters.reviewType) query.reviewType = filters.reviewType;
    if (filters.rating) query.rating = filters.rating;
    if (filters.visitType) query.visitType = filters.visitType;
    
    let sortBy = {};
    switch (filters.sortBy) {
        case 'newest':
            sortBy = { createdAt: -1 };
            break;
        case 'oldest':
            sortBy = { createdAt: 1 };
            break;
        case 'highest':
            sortBy = { rating: -1 };
            break;
        case 'lowest':
            sortBy = { rating: 1 };
            break;
        case 'helpful':
            sortBy = { 'helpfulVotes.helpful': -1 };
            break;
        default:
            sortBy = { createdAt: -1 };
    }
    
    return this.find(query)
        .populate('user', 'name avatar')
        .populate('room', 'name type')
                .sort(sortBy);
};

// Update related models when review is approved
ReviewSchema.post('save', async function() {
    if (this.isApproved && !this.flags.isHidden) {
        try {
            if (this.room) {
                const Room = mongoose.model('Room');
                const room = await Room.findById(this.room);
                if (room) {
                    await room.updateAverageRating();
                }
            }
        } catch (error) {
            console.error('Error updating ratings:', error);
        }
    }
});

module.exports = mongoose.model('Review', ReviewSchema);