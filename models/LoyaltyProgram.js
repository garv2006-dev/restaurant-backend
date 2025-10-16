const mongoose = require('mongoose');

const loyaltyProgramSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  pointsPerRupee: {
    type: Number,
    default: 1, // 1 point per rupee spent
    min: 0
  },
  minimumSpend: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rewards: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    pointsRequired: {
      type: Number,
      required: true,
      min: 0
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'freeItem'],
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    maxDiscount: {
      type: Number,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  tiers: [{
    name: {
      type: String,
      required: true
    },
    minimumPoints: {
      type: Number,
      required: true,
      min: 0
    },
    benefits: {
      pointMultiplier: {
        type: Number,
        default: 1
      },
      discountPercentage: {
        type: Number,
        default: 0,
        max: 100
      },
      perks: [String]
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
loyaltyProgramSchema.index({ isActive: 1 });
loyaltyProgramSchema.index({ 'rewards.pointsRequired': 1 });
loyaltyProgramSchema.index({ 'tiers.minimumPoints': 1 });

module.exports = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);