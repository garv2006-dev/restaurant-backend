const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');

// @desc    Get active loyalty program
// @route   GET /api/loyalty/program
// @access  Public
const getLoyaltyProgram = async (req, res) => {
  try {
    const program = await LoyaltyProgram.findOne({ isActive: true });
    
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

    // Here you would create a discount code or apply the reward
    // For now, we'll just return success
    
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

// @desc    Create/Update loyalty program (Admin only)
// @route   POST /api/loyalty/programs
// @access  Private/Admin
const createLoyaltyProgram = async (req, res) => {
  try {
    const { name, description, pointsPerRupee, rewards, tiers, isActive } = req.body;
    
    const program = new LoyaltyProgram({
      name,
      description,
      pointsPerRupee,
      rewards,
      tiers,
      isActive
    });

    await program.save();

    res.status(201).json({
      success: true,
      message: 'Loyalty program created successfully',
      data: program
    });
  } catch (error) {
    console.error('Error creating loyalty program:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating loyalty program'
    });
  }
};

// @desc    Get all loyalty programs (Admin only)
// @route   GET /api/loyalty/programs
// @access  Private/Admin
const getAllLoyaltyPrograms = async (req, res) => {
  try {
    const programs = await LoyaltyProgram.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: programs.length,
      programs
    });
  } catch (error) {
    console.error('Error fetching loyalty programs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loyalty programs'
    });
  }
};

// @desc    Update loyalty program (Admin only)
// @route   PUT /api/loyalty/programs/:id
// @access  Private/Admin
const updateLoyaltyProgram = async (req, res) => {
  try {
    const program = await LoyaltyProgram.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Loyalty program updated successfully',
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

// @desc    Delete loyalty program (Admin only)
// @route   DELETE /api/loyalty/programs/:id
// @access  Private/Admin
const deleteLoyaltyProgram = async (req, res) => {
  try {
    const program = await LoyaltyProgram.findByIdAndDelete(req.params.id);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty program not found'
      });
    }

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

// @desc    Get all users loyalty data (Admin only)
// @route   GET /api/loyalty/users
// @access  Private/Admin
const getUsersLoyaltyData = async (req, res) => {
  try {
    const users = await User.find(
      { loyaltyPoints: { $gt: 0 } },
      'name email loyaltyPoints loyaltyTier totalPointsEarned totalPointsRedeemed loyaltyJoinDate'
    ).sort({ loyaltyPoints: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error fetching users loyalty data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users loyalty data'
    });
  }
};

// @desc    Award points for booking (Internal use)
// @route   POST /api/loyalty/award-points
// @access  Private
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
  getUserLoyaltyPoints,
  redeemLoyaltyPoints,
  addLoyaltyPoints,
  createLoyaltyProgram,
  getAllLoyaltyPrograms,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  getUsersLoyaltyData,
  awardPointsForBooking
};