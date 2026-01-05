const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');
const Review = require('../models/Review');
const mongoose = require('mongoose');

// @desc    Get comprehensive analytics report
// @route   GET /api/admin/reports
// @access  Private/Admin
exports.getAnalyticsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Booking Analytics
    const bookingStats = await getBookingAnalytics(start, end);
    
    // Room Analytics
    const roomStats = await getRoomAnalytics(start, end);
    
    // Customer Analytics
    const customerStats = await getCustomerAnalytics(start, end);
    
    // Revenue Analytics
    const revenueStats = await getRevenueAnalytics(start, end);
    
    // Performance Analytics
    const performanceStats = await getPerformanceAnalytics(start, end);

    const reportData = {
      dateRange: { startDate: start, endDate: end },
      bookings: bookingStats,
      rooms: roomStats,
      customers: customerStats,
      revenue: revenueStats,
      performance: performanceStats
    };

    res.status(200).json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('Error generating analytics report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating report'
    });
  }
};

// Helper function for booking analytics
const getBookingAnalytics = async (startDate, endDate) => {
  const bookings = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        confirmed: {
          $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'CheckedOut'] }, 1, 0] }
        },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalNights: { $sum: '$bookingDates.nights' }
      }
    }
  ]);

  const stats = bookings[0] || {
    total: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    totalRevenue: 0,
    totalNights: 0
  };

  // Calculate occupancy rate
  const totalRooms = await Room.countDocuments({ isActive: true });
  const totalPossibleNights = totalRooms * Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const occupancyRate = totalPossibleNights > 0 ? ((stats.totalNights / totalPossibleNights) * 100).toFixed(1) : 0;

  return {
    total: stats.total,
    confirmed: stats.confirmed,
    cancelled: stats.cancelled,
    completed: stats.completed,
    revenue: stats.totalRevenue,
    averageBookingValue: stats.total > 0 ? (stats.totalRevenue / stats.total).toFixed(2) : 0,
    occupancyRate: parseFloat(occupancyRate)
  };
};

// Helper function for room analytics
const getRoomAnalytics = async (startDate, endDate) => {
  const totalRooms = await Room.countDocuments();
  const availableRooms = await Room.countDocuments({ status: 'Available' });
  const occupiedRooms = await Room.countDocuments({ status: 'Occupied' });
  const maintenanceRooms = await Room.countDocuments({ status: 'Maintenance' });

  // Room type distribution with revenue
  const roomTypeStats = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $lookup: {
        from: 'rooms',
        localField: 'room',
        foreignField: '_id',
        as: 'roomInfo'
      }
    },
    {
      $unwind: '$roomInfo'
    },
    {
      $group: {
        _id: '$roomInfo.type',
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.totalAmount' }
      }
    },
    {
      $project: {
        type: '$_id',
        count: 1,
        revenue: 1,
        _id: 0
      }
    }
  ]);

  return {
    totalRooms,
    availableRooms,
    occupiedRooms,
    maintenanceRooms,
    roomTypeDistribution: roomTypeStats
  };
};

// Helper function for customer analytics
const getCustomerAnalytics = async (startDate, endDate) => {
  const totalCustomers = await User.countDocuments({ role: 'customer' });
  const newCustomers = await User.countDocuments({
    role: 'customer',
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  // Returning customers (customers who made bookings in this period and had previous bookings)
  const returningCustomers = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'bookings',
        let: { userId: '$user' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$user', '$$userId'] },
              createdAt: { $lt: startDate }
            }
          }
        ],
        as: 'previousBookings'
      }
    },
    {
      $match: {
        'previousBookings.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$user'
      }
    },
    {
      $count: 'returningCustomers'
    }
  ]);

  return {
    totalCustomers,
    newCustomers,
    returningCustomers: returningCustomers[0]?.returningCustomers || 0
  };
};

// Helper function for revenue analytics
const getRevenueAnalytics = async (startDate, endDate) => {
  // Monthly revenue breakdown
  const monthlyRevenue = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$pricing.totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    {
      $project: {
        month: {
          $dateToString: {
            format: '%Y-%m',
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: 1
              }
            }
          }
        },
        revenue: 1,
        bookings: 1,
        _id: 0
      }
    },
    {
      $sort: { month: 1 }
    }
  ]);

  // Revenue by source
  const revenueBreakdown = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.totalAmount' },
        roomRevenue: { $sum: '$pricing.roomPrice' }
      }
    }
  ]);

  const breakdown = revenueBreakdown[0] || {
    totalRevenue: 0,
    roomRevenue: 0
  };

  return {
    totalRevenue: breakdown.totalRevenue,
    roomRevenue: breakdown.roomRevenue,
    monthlyRevenue
  };
};

// Helper function for performance analytics
const getPerformanceAnalytics = async (startDate, endDate) => {
  // Customer satisfaction
  const reviewStats = await Review.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  const reviewData = reviewStats[0] || { averageRating: 0, totalReviews: 0 };
  const customerSatisfaction = reviewData.averageRating > 0 ? (reviewData.averageRating / 5 * 100).toFixed(1) : 0;

  return {
    customerSatisfaction: parseFloat(customerSatisfaction),
    averageRating: reviewData.averageRating || 0
  };
};

// @desc    Export analytics report
// @route   GET /api/admin/reports/export
// @access  Private/Admin
exports.exportReport = async (req, res) => {
  try {
    const { format, startDate, endDate } = req.query;
    
    if (!format || !['pdf', 'excel'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use pdf or excel'
      });
    }

    // For now, return a simple response
    // In a real implementation, you would generate actual PDF/Excel files
    res.status(200).json({
      success: true,
      message: `${format.toUpperCase()} export functionality would be implemented here`,
      data: {
        format,
        dateRange: { startDate, endDate },
        note: 'This would generate and return the actual file'
      }
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting report'
    });
  }
};

// @desc    Get live dashboard data
// @route   GET /api/admin/dashboard/live
// @access  Private/Admin
exports.getLiveDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Live metrics
    const liveMetrics = await getLiveMetrics(today, tomorrow);
    
    // Recent bookings (last 10)
    const recentBookings = await getRecentBookings();
    
    // Today's hourly revenue
    const revenueToday = await getTodayHourlyRevenue(today, tomorrow);
    
    // Room status
    const roomStatus = await getCurrentRoomStatus();
    
    // System alerts (mock data for now)
    const alerts = [
      {
        type: 'info',
        message: 'System backup completed successfully',
        timestamp: new Date().toISOString()
      },
      {
        type: 'warning',
        message: 'Room 101 maintenance scheduled for tomorrow',
        timestamp: new Date().toISOString()
      }
    ];

    const dashboardData = {
      liveMetrics,
      recentBookings,
      revenueToday,
      roomStatus,
      alerts
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching live dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching live dashboard data'
    });
  }
};

// Helper function for live metrics
const getLiveMetrics = async (today, tomorrow) => {
  const [bookingStats, revenueStats] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          todayBookings: { $sum: 1 },
          pendingCheckIns: {
            $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] }
          },
          pendingCheckOuts: {
            $sum: { $cond: [{ $eq: ['$status', 'CheckedIn'] }, 1, 0] }
          }
        }
      }
    ]),
    Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: { $ne: 'Cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$pricing.totalAmount' }
        }
      }
    ])
  ]);

  const bookingData = bookingStats[0] || { todayBookings: 0, pendingCheckIns: 0, pendingCheckOuts: 0 };
  const revenueData = revenueStats[0] || { todayRevenue: 0 };

  // Mock active users (in real app, you'd track this via sessions/websockets)
  const activeUsers = Math.floor(Math.random() * 50) + 10;

  return {
    currentOccupancy: 0, // Will be calculated from room status
    todayBookings: bookingData.todayBookings,
    todayRevenue: revenueData.todayRevenue,
    activeUsers,
    pendingCheckIns: bookingData.pendingCheckIns,
    pendingCheckOuts: bookingData.pendingCheckOuts
  };
};

// Helper function for recent bookings
const getRecentBookings = async () => {
  return await Booking.find({})
    .populate('user', 'name email')
    .populate('room', 'name type')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('bookingId status pricing.totalAmount createdAt');
};

// Helper function for today's hourly revenue
const getTodayHourlyRevenue = async (today, tomorrow) => {
  const hourlyRevenue = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $ne: 'Cancelled' }
      }
    },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        revenue: { $sum: '$pricing.totalAmount' }
      }
    },
    {
      $project: {
        hour: { $concat: [{ $toString: '$_id' }, ':00'] },
        revenue: 1,
        _id: 0
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);

  // Fill missing hours with 0 revenue
  const allHours = [];
  for (let i = 0; i < 24; i++) {
    const existing = hourlyRevenue.find(h => h.hour === `${i}:00`);
    allHours.push({
      hour: `${i.toString().padStart(2, '0')}:00`,
      revenue: existing ? existing.revenue : 0
    });
  }

  return allHours;
};

module.exports = {
  getAnalyticsReport: exports.getAnalyticsReport,
  exportReport: exports.exportReport,
  getLiveDashboard: exports.getLiveDashboard
};