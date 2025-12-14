const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { emitNewOrder, emitOrderStatusChange, emitUserNotification } = require('../config/socket');

// @desc    Create new order from cart/menu
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { items, subtotal, taxes, total, paymentMethod, notes } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item',
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to place order',
      });
    }

    const normalizedItems = items.map((item) => ({
      menuItem: item.id || item.menuItem,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    }));

    const computedSubtotal = normalizedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );

    const sSubtotal = Number(subtotal ?? computedSubtotal);
    const sTaxes = Number(taxes ?? 0);
    const sTotal = Number(total ?? sSubtotal + sTaxes);

    if (!Number.isFinite(sSubtotal) || !Number.isFinite(sTaxes) || !Number.isFinite(sTotal)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pricing values',
      });
    }

    const order = await Order.create({
      user: req.user.id,
      items: normalizedItems,
      subtotal: sSubtotal,
      taxes: sTaxes,
      total: sTotal,
      paymentMethod: paymentMethod || 'cod',
      notes
    });

    // Create payment record automatically
    let payment = null;
    try {
      const normalizedPaymentMethod = paymentMethod === 'cod' ? 'Cash' : 
                                     paymentMethod === 'card' ? 'CreditCard' : 
                                     paymentMethod === 'upi' ? 'UPI' : 'Cash';
      
      const paymentData = {
        order: order._id,
        user: req.user.id,
        amount: sTotal,
        paymentMethod: normalizedPaymentMethod,
        gateway: 'Manual',
        status: paymentMethod === 'cod' ? 'Pending' : 'Completed'
      };

      // Add transaction ID for non-cash payments
      if (paymentMethod !== 'cod') {
        paymentData.transactionId = `TXN${Date.now()}`;
      }

      payment = await Payment.create(paymentData);

      // Update order payment status
      order.status = paymentMethod === 'cod' ? 'Pending' : 'Paid';
      await order.save();

    } catch (paymentError) {
      console.error('Payment creation error:', paymentError);
      // Continue even if payment creation fails
    }

    // Send order confirmation email
    try {
      const emailMessage = `
        Dear ${req.user.name},
        
        Your order has been placed successfully!
        
        Order Details:
        - Order ID: ${order.orderNumber}
        - Total Amount: $${sTotal.toFixed(2)}
        - Payment Method: ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
        - Status: ${order.status}
        
        Order Items:
        ${normalizedItems.map(item => `- ${item.name} x${item.quantity}: $${(item.price * item.quantity).toFixed(2)}`).join('\n')}
        
        ${paymentMethod === 'cod' ? 'Please pay when your order is delivered.' : 'Thank you for your payment!'}
        
        We hope you enjoy your meal!
        
        Best regards,
        Restaurant Team
      `;

      await sendEmail({
        email: req.user.email,
        subject: `Order Confirmation - ${order.orderNumber}`,
        message: emailMessage
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    // Emit real-time notifications
    try {
      // Emit new order to admin dashboard
      emitNewOrder({
        orderNumber: order.orderNumber,
        customerName: req.user.name,
        total: sTotal,
        status: order.status,
        paymentMethod,
        itemCount: normalizedItems.length
      });

      // Send notification to user
      emitUserNotification(req.user.id, {
        title: 'Order Placed Successfully!',
        message: `Your order ${order.orderNumber} has been placed and will be delivered soon`,
        type: 'success',
        orderNumber: order.orderNumber
      });
    } catch (socketError) {
      console.error('Socket notification error:', socketError);
    }

    // Award loyalty points for completed order
    try {
      const pointsToAdd = Math.floor(sTotal * 0.1); // ₹10 spent = 1 point (10 points per ₹100)
      const user = await User.findById(req.user.id);
      
      if (user) {
        user.loyaltyPoints += pointsToAdd;
        user.totalPointsEarned += pointsToAdd;
        await user.save();
        
        console.log(`Awarded ${pointsToAdd} loyalty points to user ${req.user.id} for order ${order.orderNumber}`);
      }
    } catch (loyaltyError) {
      console.error('Error awarding loyalty points for order:', loyaltyError);
    }

    return res.status(201).json({
      success: true,
      message: 'Your order has been placed successfully!',
      data: {
        id: order._id,
        orderId: order.orderNumber,
        status: order.status,
        total: order.total,
        items: normalizedItems
      },
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = { user: req.user.id };
    
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('items.menuItem', 'name price images')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      },
      data: orders
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.menuItem', 'name price images description');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
};
