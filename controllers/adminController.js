const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        // Calculate date range based on period
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get overview stats
        const totalUsers = await User.countDocuments({ role: 'customer' });
        const totalRooms = await Room.countDocuments();
        const totalBookings = await Booking.countDocuments();
        const totalRevenue = await Payment.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get period stats
        const periodBookings = await Booking.countDocuments({
            createdAt: { $gte: startDate }
        });
        
        const periodRevenue = await Payment.aggregate([
            { 
                $match: { 
                    status: 'Completed',
                    createdAt: { $gte: startDate }
                } 
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const newUsers = await User.countDocuments({
            role: 'customer',
            createdAt: { $gte: startDate }
        });

        // Get booking status distribution
        const bookingsByStatus = await Booking.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get room occupancy
        const occupiedRooms = await Room.countDocuments({ status: 'Occupied' });
        const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

        // Get recent bookings
        const recentBookings = await Booking.find()
            .populate('user', 'name email')
            .populate('room', 'name type')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get pending reviews
        const pendingReviews = await Review.countDocuments({ isApproved: false });

        // Get revenue trend (last 7 days)
        const revenueTrend = await Payment.aggregate([
            {
                $match: {
                    status: 'Completed',
                    createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    revenue: { $sum: '$amount' },
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalRooms,
                    totalBookings,
                    totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
                    occupancyRate: Math.round(occupancyRate)
                },
                period: {
                    periodBookings,
                    periodRevenue: periodRevenue.length > 0 ? periodRevenue[0].total : 0,
                    newUsers
                },
                bookingsByStatus,
                recentBookings,
                pendingReviews,
                revenueTrend
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get all bookings (Admin)
// @route   GET /api/admin/bookings
// @access  Private/Admin
const getAllBookings = async (req, res) => {
    try {
        const {
            status,
            paymentStatus,
            dateFrom,
            dateTo,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let query = {};

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        if (search) {
            query.$or = [
                { bookingId: { $regex: search, $options: 'i' } },
                { 'guestDetails.primaryGuest.name': { $regex: search, $options: 'i' } },
                { 'guestDetails.primaryGuest.email': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
            .populate('user', 'name email phone')
            .populate('room', 'name type roomNumber')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await Booking.countDocuments(query);

        res.status(200).json({
            success: true,
            count: bookings.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: bookings
        });

    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update booking status (Admin)
// @route   PUT /api/admin/bookings/:id/status
// @access  Private/Admin
const updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const sendEmail = require('../utils/sendEmail');

        const booking = await Booking.findById(req.params.id)
            .populate('user', 'name email')
            .populate('room', 'name type roomNumber');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const oldStatus = booking.status;
        booking.status = status;

        // Update room status based on booking status
        if (status === 'Confirmed' && oldStatus === 'Pending') {
            // Mark room as reserved when booking is confirmed
            await Room.findByIdAndUpdate(booking.room, { status: 'Available' }); // Keep as available until check-in
        } else if (status === 'CheckedIn' && oldStatus !== 'CheckedIn') {
            await Room.findByIdAndUpdate(booking.room, { status: 'Occupied' });
        } else if (status === 'CheckedOut' && oldStatus === 'CheckedIn') {
            await Room.findByIdAndUpdate(booking.room, { status: 'Available' });
        } else if (status === 'Cancelled' || status === 'NoShow') {
            await Room.findByIdAndUpdate(booking.room, { status: 'Available' });
        }

        await booking.save();

        // Send email notifications based on status change
        try {
            const guestName = booking.guestDetails?.primaryGuest?.name || 'Guest';
            const guestEmail = booking.guestDetails?.primaryGuest?.email || booking.user?.email;
            const roomName = booking.room?.name || 'Unknown Room';
            const checkInDate = new Date(booking.bookingDates.checkInDate).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const checkOutDate = new Date(booking.bookingDates.checkOutDate).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            let emailSubject = '';
            let emailMessage = '';

            if (status === 'Confirmed' && oldStatus === 'Pending') {
                emailSubject = `Booking Confirmed - ${booking.bookingId}`;
                emailMessage = `
                    <p>Dear ${guestName},</p>
                    
                    <p>Great news! Your booking has been <strong>confirmed</strong>.</p>
                    
                    <h4 style="color: #28a745; margin-top: 20px;">Booking Details:</h4>
                    <ul style="list-style: none; padding-left: 0;">
                        <li><strong>Booking ID:</strong> ${booking.bookingId}</li>
                        <li><strong>Room:</strong> ${roomName}</li>
                        <li><strong>Check-in Date:</strong> ${checkInDate}</li>
                        <li><strong>Check-out Date:</strong> ${checkOutDate}</li>
                        <li><strong>Number of Nights:</strong> ${booking.bookingDates.nights}</li>
                        <li><strong>Total Amount:</strong> ₹${booking.pricing.totalAmount.toFixed(2)}</li>
                    </ul>
                    
                    <p style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
                        <strong style="color: #0c5460;">✓ The room is available for your dates.</strong> 
                        You can proceed with your booking. Our team will be ready to welcome you!
                    </p>
                    
                    <p>If you have any questions or special requests, please don't hesitate to contact us.</p>
                    
                    <p style="margin-top: 30px; color: #666;">
                        Best regards,<br>
                        <strong>Luxury Hotel & Rooms Team</strong>
                    </p>
                `;
            } else if (status === 'Cancelled') {
                emailSubject = `Booking Cancelled - ${booking.bookingId}`;
                emailMessage = `
                    <p>Dear ${guestName},</p>
                    
                    <p>We regret to inform you that your booking has been cancelled.</p>
                    
                    <h4 style="color: #dc3545; margin-top: 20px;">Booking Details:</h4>
                    <ul style="list-style: none; padding-left: 0;">
                        <li><strong>Booking ID:</strong> ${booking.bookingId}</li>
                        <li><strong>Room:</strong> ${roomName}</li>
                        <li><strong>Check-in Date:</strong> ${checkInDate}</li>
                        <li><strong>Check-out Date:</strong> ${checkOutDate}</li>
                    </ul>
                    
                    <p style="background-color: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
                        <strong style="color: #721c24;">✗ Your booking has been cancelled.</strong> 
                        We apologize for any inconvenience caused.
                    </p>
                    
                    <p>If you have any questions or would like to make a new booking, please contact us.</p>
                    
                    <p style="margin-top: 30px; color: #666;">
                        Best regards,<br>
                        <strong>Luxury Hotel & Rooms Team</strong>
                    </p>
                `;
            } else if (status === 'CheckedIn' && oldStatus === 'Confirmed') {
                emailSubject = `Welcome! Check-in Confirmed - ${booking.bookingId}`;
                emailMessage = `
                    <p>Dear ${guestName},</p>
                    
                    <p>Welcome to our hotel! You have been successfully checked in.</p>
                    
                    <h4 style="color: #17a2b8; margin-top: 20px;">Check-in Details:</h4>
                    <ul style="list-style: none; padding-left: 0;">
                        <li><strong>Booking ID:</strong> ${booking.bookingId}</li>
                        <li><strong>Room:</strong> ${roomName}</li>
                        <li><strong>Check-in Date:</strong> ${checkInDate}</li>
                        <li><strong>Check-out Date:</strong> ${checkOutDate}</li>
                    </ul>
                    
                    <p style="background-color: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0;">
                        <strong style="color: #0c5460;">✓ You are now checked in!</strong> 
                        Enjoy your stay with us. If you need anything, please don't hesitate to contact our front desk.
                    </p>
                    
                    <p>We hope you have a wonderful stay!</p>
                    
                    <p style="margin-top: 30px; color: #666;">
                        Best regards,<br>
                        <strong>Luxury Hotel & Rooms Team</strong>
                    </p>
                `;
            } else if (status === 'CheckedOut' && oldStatus === 'CheckedIn') {
                emailSubject = `Thank You! Check-out Completed - ${booking.bookingId}`;
                emailMessage = `
                    <p>Dear ${guestName},</p>
                    
                    <p>Thank you for staying with us! You have been successfully checked out.</p>
                    
                    <h4 style="color: #6c757d; margin-top: 20px;">Check-out Details:</h4>
                    <ul style="list-style: none; padding-left: 0;">
                        <li><strong>Booking ID:</strong> ${booking.bookingId}</li>
                        <li><strong>Room:</strong> ${roomName}</li>
                        <li><strong>Check-in Date:</strong> ${checkInDate}</li>
                        <li><strong>Check-out Date:</strong> ${checkOutDate}</li>
                    </ul>
                    
                    <p style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #6c757d; margin: 20px 0;">
                        <strong style="color: #495057;">✓ Check-out completed successfully!</strong> 
                        We hope you enjoyed your stay with us.
                    </p>
                    
                    <p>We would love to hear about your experience. Please consider leaving us a review!</p>
                    
                    <p>We look forward to welcoming you back soon.</p>
                    
                    <p style="margin-top: 30px; color: #666;">
                        Best regards,<br>
                        <strong>Luxury Hotel & Rooms Team</strong>
                    </p>
                `;
            } else if (status === 'NoShow') {
                emailSubject = `No Show - ${booking.bookingId}`;
                emailMessage = `
                    <p>Dear ${guestName},</p>
                    
                    <p>We noticed that you did not arrive for your scheduled check-in.</p>
                    
                    <h4 style="color: #dc3545; margin-top: 20px;">Booking Details:</h4>
                    <ul style="list-style: none; padding-left: 0;">
                        <li><strong>Booking ID:</strong> ${booking.bookingId}</li>
                        <li><strong>Room:</strong> ${roomName}</li>
                        <li><strong>Check-in Date:</strong> ${checkInDate}</li>
                        <li><strong>Check-out Date:</strong> ${checkOutDate}</li>
                    </ul>
                    
                    <p style="background-color: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
                        <strong style="color: #721c24;">Your booking has been marked as No Show.</strong> 
                        If this was due to unforeseen circumstances, please contact us.
                    </p>
                    
                    <p>If you still plan to arrive, please contact us immediately to check availability.</p>
                    
                    <p style="margin-top: 30px; color: #666;">
                        Best regards,<br>
                        <strong>Luxury Hotel & Rooms Team</strong>
                    </p>
                `;
            }

            // Send email if there's a message to send
            if (emailMessage && guestEmail) {
                await sendEmail({
                    email: guestEmail,
                    subject: emailSubject,
                    message: emailMessage
                });
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Don't fail the request if email fails to send
        }

        // Send in-app notifications
        try {
            const { createRoomBookingNotification } = require('./notificationController');
            const { emitUserNotification } = require('../config/socket');
            
            let notificationAction = '';
            let notificationTitle = '';
            let notificationMessage = '';

            if (status === 'Confirmed' && oldStatus === 'Pending') {
                notificationAction = 'confirmed_by_admin';
                notificationTitle = '✅ Booking Confirmed by Admin';
                notificationMessage = `Great news! Your booking ${booking.bookingId} has been confirmed by our team.`;
            } else if (status === 'Cancelled') {
                notificationAction = 'cancelled_by_admin';
                notificationTitle = '❌ Booking Cancelled by Admin';
                notificationMessage = `Your booking ${booking.bookingId} has been cancelled by our administrator.`;
            } else if (status === 'CheckedIn') {
                notificationAction = 'checked_in';
                notificationTitle = '🔑 Check-in Completed';
                notificationMessage = `Welcome! You have been checked in for booking ${booking.bookingId}.`;
            } else if (status === 'CheckedOut') {
                notificationAction = 'checked_out';
                notificationTitle = '👋 Check-out Completed';
                notificationMessage = `Thank you for staying with us! Check-out completed for booking ${booking.bookingId}.`;
            } else if (status === 'NoShow') {
                notificationAction = 'no_show';
                notificationTitle = '⏰ No Show Recorded';
                notificationMessage = `Your booking ${booking.bookingId} has been marked as no-show.`;
            }

            if (notificationAction) {
                // Send real-time notification
                emitUserNotification(booking.user._id || booking.user, {
                    title: notificationTitle,
                    message: notificationMessage,
                    type: status === 'Confirmed' ? 'success' : status === 'Cancelled' || status === 'NoShow' ? 'warning' : 'info',
                    bookingId: booking.bookingId,
                });

                // Create database notification
                await createRoomBookingNotification(
                    booking.user._id || booking.user,
                    { booking, room: booking.room, status: status },
                    notificationAction
                );
            }
        } catch (notificationError) {
            console.error('Notification creation error:', notificationError);
            // Don't fail the request if notification fails
        }

        res.status(200).json({
            success: true,
            data: booking
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get all orders (Admin) - DISABLED: No Order model exists
// @route   GET /api/admin/orders
// @access  Private/Admin
// @desc    Get all users (Admin)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        const {
            role,
            status,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let query = {};

        if (role) query.role = role;
        if (status) {
            if (status === 'verified') {
                query.isEmailVerified = true;
            } else if (status === 'unverified') {
                query.isEmailVerified = false;
            }
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(skip);

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: users
        });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update user status (Admin)
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res) => {
    try {
        const { isEmailVerified, role } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (isEmailVerified !== undefined) {
            user.isEmailVerified = isEmailVerified;
        }

        if (role !== undefined) {
            user.role = role;
        }

        await user.save();

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get revenue analytics
// @route   GET /api/admin/analytics/revenue
// @access  Private/Admin
const getRevenueAnalytics = async (req, res) => {
    try {
        const { period = 'month', year = new Date().getFullYear() } = req.query;

        let groupBy, startDate, endDate;

        if (period === 'day') {
            // Last 30 days
            endDate = new Date();
            startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            groupBy = {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
        } else if (period === 'month') {
            // 12 months of specified year
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
            groupBy = {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
            };
        } else if (period === 'year') {
            // Last 5 years
            endDate = new Date();
            startDate = new Date(endDate.getFullYear() - 4, 0, 1);
            groupBy = {
                year: { $year: '$createdAt' }
            };
        }

        const revenueData = await Payment.aggregate([
            {
                $match: {
                    status: 'Completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: groupBy,
                    revenue: { $sum: '$amount' },
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Get payment method distribution
        const paymentMethods = await Payment.aggregate([
            {
                $match: {
                    status: 'Completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$method',
                    amount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get room type revenue
        const roomTypeRevenue = await Booking.aggregate([
            {
                $match: {
                    paymentStatus: 'Paid',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: 'room',
                    foreignField: '_id',
                    as: 'roomDetails'
                }
            },
            { $unwind: '$roomDetails' },
            {
                $group: {
                    _id: '$roomDetails.type',
                    revenue: { $sum: '$pricing.totalAmount' },
                    bookings: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                revenueData,
                paymentMethods,
                roomTypeRevenue
            }
        });

    } catch (error) {
        console.error('Get revenue analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Generate reports
// @route   GET /api/admin/reports
// @access  Private/Admin
const generateReports = async (req, res) => {
    try {
        const { type, startDate, endDate } = req.query;

        const start = new Date(startDate);
        const end = new Date(endDate);

        let reportData = {};

        switch (type) {
            case 'booking':
                reportData = await Booking.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'user',
                            foreignField: '_id',
                            as: 'userDetails'
                        }
                    },
                    {
                        $lookup: {
                            from: 'rooms',
                            localField: 'room',
                            foreignField: '_id',
                            as: 'roomDetails'
                        }
                    },
                    { $unwind: '$userDetails' },
                    { $unwind: '$roomDetails' },
                    {
                        $project: {
                            bookingId: 1,
                            customerName: '$userDetails.name',
                            customerEmail: '$userDetails.email',
                            roomName: '$roomDetails.name',
                            roomType: '$roomDetails.type',
                            checkInDate: '$bookingDates.checkInDate',
                            checkOutDate: '$bookingDates.checkOutDate',
                            totalAmount: '$pricing.totalAmount',
                            status: 1,
                            paymentStatus: 1,
                            createdAt: 1
                        }
                    }
                ]);
                break;

            case 'revenue':
                reportData = await Payment.aggregate([
                    {
                        $match: {
                            status: 'Completed',
                            createdAt: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $lookup: {
                            from: 'bookings',
                            localField: 'booking',
                            foreignField: '_id',
                            as: 'bookingDetails'
                        }
                    },
                    { $unwind: '$bookingDetails' },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$createdAt' },
                                month: { $month: '$createdAt' }
                            },
                            totalRevenue: { $sum: '$amount' },
                            bookingCount: { $sum: 1 }
                        }
                    }
                ]);
                break;

            case 'customer':
                reportData = await User.aggregate([
                    {
                        $match: {
                            role: 'customer',
                            createdAt: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $lookup: {
                            from: 'bookings',
                            localField: '_id',
                            foreignField: 'user',
                            as: 'bookings'
                        }
                    },
                    {
                        $project: {
                            name: 1,
                            email: 1,
                            phone: 1,
                            loyaltyPoints: 1,
                            totalBookings: { $size: '$bookings' },
                            createdAt: 1
                        }
                    }
                ]);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type'
                });
        }

        res.status(200).json({
            success: true,
            data: {
                type,
                period: { startDate: start, endDate: end },
                records: reportData.length,
                data: reportData
            }
        });

    } catch (error) {
        console.error('Generate reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSystemSettings = async (req, res) => {
    try {
        // This would typically come from a settings collection
        // For now, returning default settings
        const settings = {
            general: {
                siteName: 'Hotel Booking System',
                siteUrl: process.env.FRONTEND_URL,
                contactEmail: 'admin@hotel-booking.com',
                timezone: 'UTC'
            },
            booking: {
                maxAdvanceBookingDays: 365,
                cancellationPolicy: 'flexible',
                checkInTime: '15:00',
                checkOutTime: '11:00'
            },
            payment: {
                currency: 'USD',
                taxRate: 18,
                paymentMethods: ['stripe', 'razorpay']
            },
            notifications: {
                emailNotifications: true,
                smsNotifications: false,
                bookingConfirmation: true,
                paymentConfirmation: true
            }
        };

        res.status(200).json({
            success: true,
            data: settings
        });

    } catch (error) {
        console.error('Get system settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create staff user
// @route   POST /api/admin/staff
// @access  Private/Admin
const createStaffUser = async (req, res) => {
    try {
        const { name, email, phone, password, role = 'staff' } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or phone already exists'
            });
        }

        const user = await User.create({
            name,
            email,
            phone,
            password,
            role,
            isEmailVerified: true // Staff accounts are pre-verified
        });

        res.status(201).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Create staff user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Mark cash payment as paid (Admin only)
// @route   PUT /api/admin/payments/:id/mark-paid
// @access  Private/Admin
const markPaymentAsPaid = async (req, res) => {
    try {
        const { transactionId, notes } = req.body;

        // Find payment
        const payment = await Payment.findById(req.params.id)
            .populate('booking');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Check if payment is already completed
        if (payment.status === 'Completed') {
            return res.status(400).json({
                success: false,
                message: 'Payment is already marked as paid'
            });
        }

        // Check if payment method is cash
        const isCashPayment = payment.paymentMethod === 'Cash' || 
                             payment.paymentMethod === 'cash' || 
                             payment.paymentMethod === 'COD';

        if (!isCashPayment) {
            return res.status(400).json({
                success: false,
                message: 'Only cash payments can be marked as paid manually'
            });
        }

        // Update payment status
        payment.status = 'Completed';
        payment.transactionId = transactionId || `CASH${Date.now()}`;
        payment.paidAt = new Date();
        payment.processedBy = req.user.id;
        if (notes) {
            payment.notes = notes;
        }
        await payment.save();

        // Update booking payment status
        const booking = await Booking.findById(payment.booking);
        if (booking) {
            booking.paymentStatus = 'Paid';
            booking.paymentDetails.paidAmount = payment.amount;
            booking.paymentDetails.paymentDate = new Date();
            booking.paymentDetails.transactionId = payment.transactionId;
            
            // If booking is still pending, confirm it
            if (booking.status === 'Pending') {
                booking.status = 'Confirmed';
            }
            
            await booking.save();

            // Send payment confirmation email
            try {
                const sendEmail = require('../utils/sendEmail');
                const guestEmail = booking.guestDetails?.primaryGuest?.email;
                const guestName = booking.guestDetails?.primaryGuest?.name || 'Guest';

                if (guestEmail) {
                    const emailMessage = `
                        <p>Dear ${guestName},</p>
                        
                        <p>We have received your cash payment for booking <strong>${booking.bookingId}</strong>.</p>
                        
                        <h4 style="color: #28a745; margin-top: 20px;">Payment Details:</h4>
                        <ul style="list-style: none; padding-left: 0;">
                            <li><strong>Amount Paid:</strong> ₹${payment.amount.toFixed(2)}</li>
                            <li><strong>Payment Method:</strong> Cash</li>
                            <li><strong>Transaction ID:</strong> ${payment.transactionId}</li>
                            <li><strong>Payment Date:</strong> ${new Date().toLocaleDateString('en-IN')}</li>
                        </ul>
                        
                        <p style="background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
                            <strong style="color: #155724;">✓ Payment Confirmed</strong><br>
                            Your booking is now fully confirmed. We look forward to welcoming you!
                        </p>
                        
                        <p style="margin-top: 30px; color: #666;">
                            Best regards,<br>
                            <strong>Luxury Hotel & Rooms Team</strong>
                        </p>
                    `;

                    await sendEmail({
                        email: guestEmail,
                        subject: `Payment Received - ${booking.bookingId}`,
                        message: `Payment of ₹${payment.amount.toFixed(2)} received for booking ${booking.bookingId}`,
                        html: emailMessage
                    });
                }
            } catch (emailError) {
                console.error('Email sending error:', emailError);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Payment marked as paid successfully',
            data: payment
        });

    } catch (error) {
        console.error('Mark payment as paid error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    getDashboardStats,
    getAllBookings,
    getAllUsers,
    updateBookingStatus,
    updateUserStatus,
    getRevenueAnalytics,
    generateReports,
    getSystemSettings,
    createStaffUser,
    markPaymentAsPaid
};