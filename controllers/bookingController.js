const Booking = require("../models/Booking");
const Room = require("../models/Room");
const User = require("../models/User");
const Payment = require("../models/Payment");
const sendEmail = require("../utils/sendEmail");
const { awardPointsForBooking } = require("./loyaltyController");
const {
  emitNewBooking,
  emitBookingStatusChange,
  emitUserNotification,
} = require("../config/socket");
const { createRoomBookingNotification, createPaymentNotification } = require("./notificationController");

// @desc    Create booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const {
      roomId,
      checkInDate,
      checkOutDate,
      guestDetails,
      specialRequests,
      preferences,
      extraServices,
      paymentDetails,
    } = req.body;

    // Find room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Check availability
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    const isAvailable = await room.isAvailableForDates(checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: "Room is not available for selected dates",
      });
    }

    // Calculate pricing
    const roomPrice = room.getPriceForDates(checkIn, checkOut);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    let subtotal = roomPrice;

    // Add extra services cost
    if (extraServices && extraServices.length > 0) {
      extraServices.forEach((service) => {
        subtotal += service.price * service.quantity;
      });
    }


    // Calculate taxes (18% GST)
    const gst = subtotal * 0.18;
    const totalAmount = subtotal + gst;

    // Create booking with proper payment method handling
    const booking = await Booking.create({
      user: req.user.id,
      room: roomId,
      guestDetails,
      bookingDates: {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
      },
      pricing: {
        roomPrice,
        extraServices: extraServices || [],
        subtotal,
        taxes: { gst },
        totalAmount,
      },
      specialRequests,
      preferences: preferences || {},
      paymentDetails: {
        method: paymentDetails?.method || "Cash",
        transactionId: paymentDetails?.transactionId || null,
        paidAmount: paymentDetails?.method !== "Cash" ? totalAmount : 0,
        paymentDate: paymentDetails?.method !== "Cash" ? new Date() : null,
      },
    });

    // Create payment record automatically
    let payment = null;
    try {
      const paymentMethod = paymentDetails?.method || "Cash";
      const paymentData = {
        booking: booking._id,
        user: req.user.id,
        amount: totalAmount,
        paymentMethod: paymentMethod,
        gateway: paymentMethod === "Cash" ? "Manual" : "Manual",
        status: paymentMethod === "Cash" ? "Pending" : "Completed",
      };

      // Add transaction ID for online payments
      if (paymentMethod !== "Cash") {
        paymentData.transactionId = `TXN${Date.now()}`;
      }

      payment = await Payment.create(paymentData);

      // Update booking payment status
      booking.paymentStatus = paymentMethod === "Cash" ? "Pending" : "Paid";
      booking.status = paymentMethod === "Cash" ? "Pending" : "Confirmed";
      await booking.save();
    } catch (paymentError) {
      console.error("Payment creation error:", paymentError);
      // Continue even if payment creation fails
    }

    // Populate booking details
    await booking.populate([
      { path: "user", select: "name email phone" },
      { path: "room", select: "name type roomNumber" },
    ]);

    // Send confirmation email
    try {

      // Build extra services list for email
      let extraServicesText = '';
      if (extraServices && extraServices.length > 0) {
        extraServicesText = '\n\nExtra Services:\n';
        extraServices.forEach((service) => {
          extraServicesText += `- ${service.name} × ${service.quantity} = ₹${(service.price * service.quantity).toFixed(2)}\n`;
        });
      }

      const emailMessage = `
Dear ${guestDetails.primaryGuest.name},

Your booking has been confirmed!

BOOKING DETAILS:
- Booking ID: ${booking.bookingId}
- Room: ${booking.room.name} (${booking.room.type}) #${booking.room.roomNumber}
- Check-in Date: ${checkIn.toDateString()}
- Check-out Date: ${checkOut.toDateString()}
- Number of Nights: ${nights}
- Total Guests: ${guestDetails.totalAdults} Adult(s), ${guestDetails.totalChildren} Child(ren)

CONTACT INFORMATION:
- Name: ${guestDetails.primaryGuest.name}
- Email: ${guestDetails.primaryGuest.email}
- Phone: ${guestDetails.primaryGuest.phone}
${guestDetails.additionalGuests && guestDetails.additionalGuests.length > 0 ? `\nAdditional Guests:\n${guestDetails.additionalGuests.map(g => `- ${g.name}`).join('\n')}` : ''}

PRICING BREAKDOWN:
- Room Rate (${nights} nights): ₹${roomPrice.toFixed(2)}${extraServicesText}
- Subtotal: ₹${subtotal.toFixed(2)}
- GST (18%): ₹${gst.toFixed(2)}
- TOTAL AMOUNT: ₹${totalAmount.toFixed(2)}

PAYMENT METHOD: ${guestDetails.primaryGuest.paymentMethod || 'Cash'}
${specialRequests ? `\nSPECIAL REQUESTS:\n${specialRequests}` : ''}

We look forward to hosting you at our luxury restaurant!

If you need to cancel or modify your booking, please contact us at info@luxuryrestaurant.com or call +1 (555) 123-4567.

Best regards,
Luxury Restaurant Booking Team
`;

      await sendEmail({
        email: guestDetails.primaryGuest.email,
        subject: `Booking Confirmation - ${booking.bookingId}`,
        message: emailMessage,
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
    }

    // Emit real-time notifications
    try {
      // Emit new booking to admin dashboard
      emitNewBooking({
        bookingId: booking.bookingId,
        customerName: guestDetails.primaryGuest.name,
        roomName: booking.room.name,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      });

      // Send notification to user
      emitUserNotification(req.user.id, {
        title: "Booking Confirmed!",
        message: `Your booking ${booking.bookingId} has been confirmed for ${booking.room.name}`,
        type: "success",
        bookingId: booking.bookingId,
      });

      // Create notification in database
      await createRoomBookingNotification(
        req.user.id,
        { booking, room: booking.room, status: booking.status },
        booking.status === 'Confirmed' ? 'confirmed' : 'created'
      );
    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
    }

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Get all bookings for user
// @route   GET /api/bookings
// @access  Private
const getBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { user: req.user.id };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate("room", "_id id name type roomNumber images")
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
        pages: Math.ceil(total / limit),
      },
      data: bookings,
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Get all bookings for admin
// @route   GET /api/bookings/admin/all
// @access  Private/Admin
const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
      .populate("user", "name email phone")
      .populate("room", "_id id name type roomNumber images")
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
        pages: Math.ceil(total / limit),
      },
      data: bookings,
    });
  } catch (error) {
    console.error("Get all bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("room", "name type roomNumber images amenities features")
      ;

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking or is admin
    if (
      booking.user._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this booking",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
const updateBooking = async (req, res) => {
  try {
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking or is admin
    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this booking",
      });
    }

    // Only allow certain fields to be updated based on status
    const allowedUpdates = ["specialRequests", "preferences"];

    if (booking.status === "Pending") {
      allowedUpdates.push("guestDetails", "extraServices");
    }

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Recalculate pricing if services or menu items are updated
    if (updates.extraServices) {
      const room = await Room.findById(booking.room);
      let subtotal = booking.pricing.roomPrice;

      if (updates.extraServices) {
        subtotal = booking.pricing.roomPrice;
        updates.extraServices.forEach((service) => {
          subtotal += service.price * service.quantity;
        });
      }


      const gst = subtotal * 0.18;
      updates["pricing.subtotal"] = subtotal;
      updates["pricing.taxes.gst"] = gst;
      updates["pricing.totalAmount"] = subtotal + gst;
    }

    booking = await Booking.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("room", "name type roomNumber");

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Update booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking or is admin
    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
      });
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: "Booking cannot be cancelled at this time",
      });
    }

    // Calculate cancellation fee
    const cancellationFee = booking.calculateCancellationFee();
    const refundAmount = booking.pricing.totalAmount - cancellationFee;

    // Update booking
    booking.status = "Cancelled";
    booking.cancellationDetails = {
      cancellationDate: new Date(),
      cancelledBy: req.user.id,
      reason: reason || "Customer cancellation",
      refundEligible: refundAmount > 0,
      cancellationFee,
    };

    if (refundAmount > 0) {
      booking.paymentDetails.refundAmount = refundAmount;
    }

    await booking.save();

    // Send cancellation email
    try {
      const emailMessage = `
                Dear ${booking.guestDetails.primaryGuest.name},
                
                Your booking has been cancelled.
                
                Booking Details:
                - Booking ID: ${booking.bookingId}
                - Cancellation Fee: $${cancellationFee.toFixed(2)}
                - Refund Amount: $${refundAmount.toFixed(2)}
                
                ${
                  refundAmount > 0
                    ? "Your refund will be processed within 5-7 business days."
                    : ""
                }
                
                Best regards,
                Restaurant Booking Team
            `;

      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `Booking Cancelled - ${booking.bookingId}`,
        message: emailMessage,
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
    }

    // Emit booking status change notification
    try {
      emitBookingStatusChange(
        booking.bookingId,
        "Cancelled",
        booking.user.toString()
      );

      emitUserNotification(booking.user.toString(), {
        title: "Booking Cancelled",
        message: `Your booking ${booking.bookingId} has been cancelled`,
        type: "warning",
        bookingId: booking.bookingId,
      });

      // Create notification in database
      await createRoomBookingNotification(
        booking.user.toString(),
        { booking, room: await Room.findById(booking.room), status: 'Cancelled' },
        req.user.role === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_user'
      );
    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Check-in booking (Admin/Staff only)
// @route   PUT /api/bookings/:id/checkin
// @access  Private/Admin
const checkInBooking = async (req, res) => {
  try {
    const { identityProof, notes } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "Confirmed") {
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be checked in",
      });
    }

    // Update booking status
    booking.status = "CheckedIn";
    booking.checkInDetails = {
      actualCheckInTime: new Date(),
      frontDeskStaff: req.user.id,
      identityProof,
      notes,
    };

    // Update room status
    await Room.findByIdAndUpdate(booking.room, { status: "Occupied" });

    await booking.save();

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Check-in booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Check-out booking (Admin/Staff only)
// @route   PUT /api/bookings/:id/checkout
// @access  Private/Admin
const checkOutBooking = async (req, res) => {
  try {
    const { roomCondition, additionalCharges, notes } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "CheckedIn") {
      return res.status(400).json({
        success: false,
        message: "Only checked-in bookings can be checked out",
      });
    }

    // Update booking status
    booking.status = "CheckedOut";
    booking.checkOutDetails = {
      actualCheckOutTime: new Date(),
      frontDeskStaff: req.user.id,
      roomCondition,
      additionalCharges: additionalCharges || [],
      notes,
    };

    // Add additional charges to total if any
    if (additionalCharges && additionalCharges.length > 0) {
      const additionalTotal = additionalCharges.reduce(
        (sum, charge) => sum + charge.amount,
        0
      );
      booking.pricing.totalAmount += additionalTotal;
    }

    // Update room status
    await Room.findByIdAndUpdate(booking.room, { status: "Available" });

    // Award loyalty points to user for completed booking
    try {
      const loyaltyResult = await awardPointsForBooking(
        booking.user,
        booking.pricing.totalAmount
      );
      if (loyaltyResult) {
        console.log(
          `Awarded ${loyaltyResult.pointsAwarded} loyalty points to user ${booking.user}`
        );
      }
    } catch (loyaltyError) {
      console.error("Error awarding loyalty points:", loyaltyError);
    }

    await booking.save();

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Check-out booking error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getAllBookings,
  getBooking,
  updateBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
};
