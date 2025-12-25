const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'freeShipping', 'buyOneGetOne'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number,
    default: null
  },
  minimumOrderAmount: {
    type: Number,
    default: 0
  },
  maximumOrderAmount: {
    type: Number,
    default: null
  },
  usageLimit: {
    total: {
      type: Number,
      default: null // null means unlimited
    },
    perUser: {
      type: Number,
      default: 1
    }
  },
  usageCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  applicableToUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  applicableToRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  applicableToMenuItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  userTierRestrictions: [{
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum']
  }],
  dayOfWeekRestrictions: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  timeRestrictions: {
    startTime: String, // Format: "HH:MM"
    endTime: String    // Format: "HH:MM"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    orderAmount: Number,
    discountAmount: Number
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
discountSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
discountSchema.index({ 'usedBy.user': 1 });

// Virtual to check if discount is currently valid
discountSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now &&
         (this.usageLimit.total === null || this.usageCount < this.usageLimit.total);
});

// Method to check if user can use this discount
discountSchema.methods.canUserUse = function(userId) {
  if (!this.isCurrentlyValid) return false;
  
  // Check if user has exceeded per-user limit
  const userUsage = this.usedBy.filter(usage => usage.user.toString() === userId.toString()).length;
  if (userUsage >= this.usageLimit.perUser) return false;
  
  // Check if specific users are restricted
  if (this.applicableToUsers.length > 0 && !this.applicableToUsers.includes(userId)) {
    return false;
  }
  
  return true;
};

// Method to apply discount to order
discountSchema.methods.calculateDiscount = function(orderAmount) {
  if (orderAmount < this.minimumOrderAmount) return 0;
  if (this.maximumOrderAmount && orderAmount > this.maximumOrderAmount) return 0;
  
  let discount = 0;
  
  switch (this.type) {
    case 'percentage':
      discount = (orderAmount * this.value) / 100;
      if (this.maxDiscount && discount > this.maxDiscount) {
        discount = this.maxDiscount;
      }
      break;
    case 'fixed':
      discount = Math.min(this.value, orderAmount);
      break;
    case 'freeShipping':
      // This would need to be handled based on shipping logic
      discount = 0; // Placeholder
      break;
    case 'buyOneGetOne':
      // This would need special handling based on items
      discount = 0; // Placeholder
      break;
  }
  
  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

module.exports = mongoose.model('Discount', discountSchema);