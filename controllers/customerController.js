const User = require('../models/User');
const Booking = require('../models/Booking');

// @desc    Get all customers (users with role 'customer')
// @route   GET /api/customers
// @access  Private/Admin
exports.getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    // Build query
    let query = { role: 'customer' };
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Get customers with pagination
    const customers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Add booking statistics for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const bookingStats = await Booking.aggregate([
          { $match: { user: customer._id } },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              totalSpent: { $sum: '$pricing.totalAmount' }
            }
          }
        ]);

        const stats = bookingStats[0] || { totalBookings: 0, totalSpent: 0 };
        
        return {
          ...customer.toObject(),
          totalBookings: stats.totalBookings,
          totalSpent: stats.totalSpent
        };
      })
    );

    res.status(200).json({
      success: true,
      data: customersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customers'
    });
  }
};

// @desc    Add new customer
// @route   POST /api/customers
// @access  Private/Admin
exports.addCustomer = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if customer already exists
    const existingCustomer = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email or phone already exists'
      });
    }

    // Create new customer
    const customer = await User.create({
      name,
      email,
      phone,
      password,
      role: 'customer',
      isEmailVerified: true
    });

    // Remove password from response
    const customerResponse = customer.toObject();
    delete customerResponse.password;

    res.status(201).json({
      success: true,
      data: customerResponse,
      message: 'Customer created successfully'
    });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding customer'
    });
  }
};
