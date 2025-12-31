const Discount = require('../models/Discount');
const User = require('../models/User');
const { validateFirstTimeDiscount } = require('../services/firstTimeUserService');

// @desc    Get all active discounts
// @route   GET /api/discounts
// @access  Public
exports.getActiveDiscounts = async (req, res) => {
  try {
    const now = new Date();
    const discounts = await Discount.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $or: [
        { 'usageLimit.total': null },
        { $expr: { $lt: ['$usageCount', '$usageLimit.total'] } }
      ]
    }).select('-usedBy -createdBy');

    res.status(200).json({
      success: true,
      data: discounts
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching discounts'
    });
  }
};

// @desc    Validate discount code
// @route   POST /api/discounts/validate
// @access  Private
exports.validateDiscount = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Discount code is required'
      });
    }

    const discount = await Discount.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code'
      });
    }

    // Check if discount is currently valid
    if (!discount.isCurrentlyValid) {
      return res.status(400).json({
        success: false,
        message: 'Discount code has expired or reached usage limit'
      });
    }

    // Check if user can use this discount
    if (!discount.canUserUse(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this discount code or are not eligible'
      });
    }

    // Additional validation for first-time user discounts
    const firstTimeValidation = await validateFirstTimeDiscount(req.user.id, code);
    if (!firstTimeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: firstTimeValidation.message
      });
    }

    // Calculate discount amount if order amount is provided
    let discountAmount = 0;
    let isApplicable = true;
    
    if (orderAmount) {
      if (orderAmount < discount.minimumOrderAmount) {
        isApplicable = false;
        return res.status(400).json({
          success: false,
          message: `Minimum order amount of ₹${discount.minimumOrderAmount} required`
        });
      }
      
      if (discount.maximumOrderAmount && orderAmount > discount.maximumOrderAmount) {
        isApplicable = false;
        return res.status(400).json({
          success: false,
          message: `Maximum order amount of ₹${discount.maximumOrderAmount} exceeded`
        });
      }
      
      discountAmount = discount.calculateDiscount(orderAmount);
    }

    res.status(200).json({
      success: true,
      message: 'Discount code is valid',
      data: {
        discount: {
          id: discount._id,
          code: discount.code,
          name: discount.name,
          description: discount.description,
          type: discount.type,
          value: discount.value,
          minimumOrderAmount: discount.minimumOrderAmount,
          maximumOrderAmount: discount.maximumOrderAmount
        },
        discountAmount,
        isApplicable
      }
    });
  } catch (error) {
    console.error('Error validating discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while validating discount'
    });
  }
};

// @desc    Apply discount to order
// @route   POST /api/discounts/apply
// @access  Private
exports.applyDiscount = async (req, res) => {
  try {
    const { discountId, orderAmount } = req.body;
    
    if (!discountId || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Discount ID and order amount are required'
      });
    }

    const discount = await Discount.findById(discountId);
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Validate discount
    if (!discount.isCurrentlyValid || !discount.canUserUse(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Discount is not applicable'
      });
    }

    // Additional validation for first-time user discounts
    const firstTimeValidation = await validateFirstTimeDiscount(req.user.id, discount.code);
    if (!firstTimeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: firstTimeValidation.message
      });
    }

    const discountAmount = discount.calculateDiscount(orderAmount);
    
    if (discountAmount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount is not applicable to this order'
      });
    }

    // Record usage
    discount.usedBy.push({
      user: req.user.id,
      usedAt: new Date(),
      orderAmount,
      discountAmount
    });
    discount.usageCount += 1;
    await discount.save();

    res.status(200).json({
      success: true,
      message: 'Discount applied successfully',
      data: {
        discountAmount,
        finalAmount: orderAmount - discountAmount
      }
    });
  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while applying discount'
    });
  }
};

// @desc    Create discount (Admin only)
// @route   POST /api/discounts
// @access  Private/Admin
exports.createDiscount = async (req, res) => {
  try {
    const discountData = {
      ...req.body,
      createdBy: req.user.id
    };

    const discount = new Discount(discountData);
    await discount.save();

    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      data: discount
    });
  } catch (error) {
    console.error('Error creating discount:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating discount'
    });
  }
};

// @desc    Update discount (Admin only)
// @route   PUT /api/discounts/:id
// @access  Private/Admin
exports.updateDiscount = async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    Object.assign(discount, req.body);
    await discount.save();

    res.status(200).json({
      success: true,
      message: 'Discount updated successfully',
      data: discount
    });
  } catch (error) {
    console.error('Error updating discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating discount'
    });
  }
};

// @desc    Delete discount (Admin only)
// @route   DELETE /api/discounts/:id
// @access  Private/Admin
exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    await discount.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting discount'
    });
  }
};

// @desc    Get all discounts with usage stats (Admin only)
// @route   GET /api/discounts/admin
// @access  Private/Admin
exports.getAllDiscountsAdmin = async (req, res) => {
  try {
    const discounts = await Discount.find()
      .populate('createdBy', 'name email')
      .populate('usedBy.user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: discounts
    });
  } catch (error) {
    console.error('Error fetching discounts for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching discounts'
    });
  }
};

module.exports = {
  getActiveDiscounts: exports.getActiveDiscounts,
  validateDiscount: exports.validateDiscount,
  applyDiscount: exports.applyDiscount,
  createDiscount: exports.createDiscount,
  updateDiscount: exports.updateDiscount,
  deleteDiscount: exports.deleteDiscount,
  getAllDiscountsAdmin: exports.getAllDiscountsAdmin
};