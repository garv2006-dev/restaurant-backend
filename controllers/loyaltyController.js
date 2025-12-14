const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');

// @desc    Get active loyalty program
// @route   GET /api/loyalty/program
// @access  Public
const getLoyaltyProgram = async (req, res) => {
  try {
    const program = await LoyaltyProgram.findOne({ isActive: true })
      .populate('rewards')
      .populate('tiers');
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'No active loyalty program found'
      });
    }

    res.status(200).json({
      success: true,
      data: program
    });
  } catch (error) {
    console.error('Error fetching loyalty program:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loyalty program'
    });
  }
};

// @desc    Get all loyalty programs (admin)
// @route   GET /api/loyalty/programs
// @access  Private/Admin
const getLoyaltyPrograms = async (req, res) => {
  try {
    const programs = await LoyaltyProgram.find({})
      .populate('rewards')
      .populate('tiers')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: programs
    });
  } catch (error) {
    console.error('Error fetching loyalty programs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loyalty programs'
    });
  }
};

// @desc    Create loyalty program (admin)
// @route   POST /api/loyalty/programs
// @access  Private/Admin
const createLoyaltyProgram = async (req, res) => {
  try {
    const program = await LoyaltyProgram.create(req.body);

    const populatedProgram = await LoyaltyProgram.findById(program._id)
      .populate('rewards')
      .populate('tiers');

    res.status(201).json({
      success: true,
      data: populatedProgram
    });
  } catch (error) {
    console.error('Error creating loyalty program:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating loyalty program'
    });
  }
};

// @desc    Update loyalty program (admin)
// @route   PUT /api/loyalty/programs/:id
// @access  Private/Admin
const updateLoyaltyProgram = async (req, res) => {
  try {
    let program = await LoyaltyProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }

    program = await LoyaltyProgram.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('rewards').populate('tiers');

    res.status(200).json({
      success: true,
      data: program
    });
  } catch (error) {
    console.error('Error updating loyalty program:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating loyalty program'
    });
  }
};

// @desc    Delete loyalty program (admin)
// @route   DELETE /api/loyalty/programs/:id
// @access  Private/Admin
const deleteLoyaltyProgram = async (req, res) => {
  try {
    const program = await LoyaltyProgram.findById(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }

    await program.remove();

    res.status(200).json({
      success: true,
      message: 'Loyalty program deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting loyalty program:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting loyalty program'
    });
  }
};

// @desc    Join loyalty program
// @route   POST /api/loyalty/join
// @access  Private
const joinLoyaltyProgram = async (req, res) => {
  try {
    const userId = req.user.id;

    // Auto-enroll user if they don't have loyalty points yet
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has loyalty points (already enrolled)
    if (user.loyaltyPoints > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of the loyalty program'
      });
    }

    // Initialize loyalty points for new member
    user.loyaltyPoints = 0;
    user.totalPointsEarned = 0;
    user.totalPointsRedeemed = 0;
    user.loyaltyTier = 'Bronze';
    user.loyaltyJoinDate = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Successfully joined the loyalty program!',
      data: {
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier
      }
    });
  } catch (error) {
    console.error('Error joining loyalty program:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while joining loyalty program'
    });
  }
};

// @desc    Get user's loyalty points and tier
// @route   GET /api/loyalty/my-points
// @access  Private
const getUserLoyaltyPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('loyaltyPoints');
    const program = await LoyaltyProgram.findOne({ isActive: true });
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'No active loyalty program found'
      });
    }

    // Determine user's tier
    let currentTier = null;
    const sortedTiers = program.tiers.sort((a, b) => b.minimumPoints - a.minimumPoints);
    
    for (let tier of sortedTiers) {
      if (user.loyaltyPoints >= tier.minimumPoints) {
        currentTier = tier;
        break;
      }
    }

    // Find next tier
    let nextTier = null;
    for (let tier of program.tiers.sort((a, b) => a.minimumPoints - b.minimumPoints)) {
      if (tier.minimumPoints > user.loyaltyPoints) {
        nextTier = tier;
        break;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        currentPoints: user.loyaltyPoints,
        currentTier,
        nextTier,
        pointsToNextTier: nextTier ? nextTier.minimumPoints - user.loyaltyPoints : 0,
        availableRewards: program.rewards.filter(reward => 
          reward.isActive && reward.pointsRequired <= user.loyaltyPoints
        )
      }
    });
  } catch (error) {
    console.error('Error fetching user loyalty points:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loyalty points'
    });
  }
};

// @desc    Get all users loyalty data (Admin only)
// @route   GET /api/loyalty/users
// @access  Private/Admin
const getUsersLoyaltyData = async (req, res) => {
  try {
    // Get all users with their loyalty data, including those with 0 points
    const users = await User.find(
      { role: 'customer' },
      'name email loyaltyPoints loyaltyTier totalPointsEarned totalPointsRedeemed loyaltyJoinDate createdAt'
    ).sort({ loyaltyPoints: -1 });

    // If no users have loyalty data, return empty array
    if (!users || users.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users loyalty data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users loyalty data'
    });
  }
};

// @desc    Redeem loyalty points for reward
// @route   POST /api/loyalty/redeem
// @access  Private
const redeemLoyaltyPoints = async (req, res) => {
  try {
    const { rewardId } = req.body;
    
    if (!rewardId) {
      return res.status(400).json({
        success: false,
        message: 'Reward ID is required'
      });
    }

    const program = await LoyaltyProgram.findOne({ isActive: true });
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'No active loyalty program found'
      });
    }

    const reward = program.rewards.id(rewardId);
    if (!reward || !reward.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found or inactive'
      });
    }

    const user = await User.findById(req.user.id);
    if (user.loyaltyPoints < reward.pointsRequired) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient loyalty points'
      });
    }

    // Deduct points
    user.loyaltyPoints -= reward.pointsRequired;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Reward redeemed successfully',
      data: {
        rewardName: reward.name,
        pointsUsed: reward.pointsRequired,
        remainingPoints: user.loyaltyPoints
      }
    });
  } catch (error) {
    console.error('Error redeeming loyalty points:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while redeeming points'
    });
  }
};

// @desc    Add loyalty points to user (Admin only)
// @route   POST /api/loyalty/add-points
// @access  Private/Admin
const addLoyaltyPoints = async (req, res) => {
  try {
    const { userId, points, reason } = req.body;
    
    if (!userId || !points) {
      return res.status(400).json({
        success: false,
        message: 'User ID and points are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.loyaltyPoints += points;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Loyalty points added successfully',
      data: {
        userId,
        pointsAdded: points,
        totalPoints: user.loyaltyPoints,
        reason: reason || 'Manual addition'
      }
    });
  } catch (error) {
    console.error('Error adding loyalty points:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding points'
    });
  }
};

// @desc    Award points for booking (Internal use)
const awardPointsForBooking = async (userId, amount) => {
  try {
    const program = await LoyaltyProgram.findOne({ isActive: true });
    if (!program) return;

    const pointsToAdd = Math.floor(amount * program.pointsPerRupee);
    if (pointsToAdd <= 0) return;

    const user = await User.findById(userId);
    if (!user) return;

    user.loyaltyPoints += pointsToAdd;
    user.totalPointsEarned += pointsToAdd;
    await user.save();

    return {
      pointsAwarded: pointsToAdd,
      totalPoints: user.loyaltyPoints
    };
  } catch (error) {
    console.error('Error awarding loyalty points:', error);
    return null;
  }
};

module.exports = {
  getLoyaltyProgram,
  getLoyaltyPrograms,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  joinLoyaltyProgram,
  getUserLoyaltyPoints,
  getUsersLoyaltyData,
  redeemLoyaltyPoints,
  addLoyaltyPoints,
  awardPointsForBooking
};
