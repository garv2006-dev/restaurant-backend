
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const RoomNumber = require("../models/RoomNumber");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const Payment = require("../models/Payment");
const Discount = require("../models/Discount");
const RoomAllocation = require("../models/RoomAllocation");
// const RewardRedemption = require("../models/RewardRedemption");
const {
  generateBookingConfirmationEmail,
  generateCancellationEmail,
  generateBookingReceivedEmail,
  generateCheckInEmail,
  generateCheckOutEmail
} = require("../utils/emailTemplates");
const {
  emitNewBooking,
  emitBookingStatusChange,
  emitUserNotification,
  emitRoomNumbersChange,
  getSocketIo
} = require("../config/socket");
const { createRoomBookingNotification } = require("./notificationController");
const {
  validateBookingDates,
  generateBookingDatesSummary
} = require("../utils/bookingDateValidation");

// @desc    Validate discount code for booking
// @route   POST /api/bookings/validate-discount
// @access  Private
const validateDiscountForBooking = async (req, res) => {
  try {
    const { discountCode, subtotal } = req.body;

    if (!discountCode) {
      return res.status(400).json({
        success: false,
        message: 'Discount code is required'
      });
    }

    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid subtotal is required'
      });
    }

    // Find discount by code
    const discount = await Discount.findOne({
      code: discountCode.toUpperCase(),
      isActive: true
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code'
      });
    }

    // Check if discount is currently valid
    const now = new Date();
    if (!discount.isActive || discount.validFrom > now || discount.validUntil < now) {
      return res.status(400).json({
        success: false,
        message: 'Discount code has expired or is not active'
      });
    }

    // Check usage limits
    if (discount.usageLimit.total !== null && discount.usageCount >= discount.usageLimit.total) {
      return res.status(400).json({
        success: false,
        message: 'Discount code has reached its usage limit'
      });
    }

    // Check if user can use this discount
    if (!discount.canUserUse(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this discount code or are not eligible'
      });
    }

    // Check minimum order amount
    if (subtotal < discount.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `This code only applies to bookings of ₹${discount.minimumOrderAmount} or more.`
      });
    }

    // Check maximum order amount
    if (discount.maximumOrderAmount && subtotal > discount.maximumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `This code is only valid for bookings up to ₹${discount.maximumOrderAmount}.`
      });
    }

    // Calculate discount amount
    const discountAmount = discount.calculateDiscount(subtotal);

    if (discountAmount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount is not applicable to this booking'
      });
    }

    // Ensure final amount is not negative
    const finalAmount = Math.max(0, subtotal - discountAmount);

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
          maxDiscount: discount.maxDiscount
        },
        discountAmount,
        finalAmount,
        savings: discountAmount
      }
    });
  } catch (error) {
    console.error('Error validating discount for booking:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while validating discount'
    });
  }
};
// @desc    Create booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const {
      selectedRooms, // Array of { roomId, count }
      roomId,        // Fallback for single-room
      roomCount: rCount, // Fallback
      checkInDate,
      checkOutDate,
      guestDetails,
      specialRequests,
      preferences,
      extraServices,
      paymentDetails,
      discountCode,
      redemptionCode,
    } = req.body;

    // Normalize selections
    let selections = selectedRooms || [];
    if (selections.length === 0 && roomId) {
      selections.push({ roomId, count: Number(rCount || 1) });
    }

    if (selections.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No rooms selected"
      });
    }

    // VALIDATE DATES
    const dateValidation = validateBookingDates(checkInDate, checkOutDate);
    if (!dateValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: dateValidation.error
      });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // We'll use normalized boundaries for everything to prevent UTC +5:30 rollover issues
    const allocCheckIn = new Date(checkIn); allocCheckIn.setUTCHours(12, 0, 0, 0); // 12 PM standard checkIn
    const allocCheckOut = new Date(checkOut); allocCheckOut.setUTCHours(12, 0, 0, 0); // 12 PM standard checkOut

    const nights = Math.round((allocCheckOut - allocCheckIn) / (1000 * 60 * 60 * 24));

    let roomPrice = 0;
    let bookingRoomsData = [];
    let roomNumberDocsToAllocate = [];
    let totalMaxCapacity = 0;
    let roomNames = [];
    let primaryRoomType = null;

    // Process each selection
    for (const sel of selections) {
      const room = await Room.findById(sel.roomId);
      if (!room) {
        return res.status(404).json({ success: false, message: `Room type ${sel.roomId} not found` });
      }
      if (!primaryRoomType) primaryRoomType = room;

      // Check availability (requested count vs available numbers)
      const isAvailable = await room.isAvailableForDates(allocCheckIn, allocCheckOut, sel.count);
      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: `${room.name} is not available for selected dates`
        });
      }

      // Capacity calculation
      totalMaxCapacity += ((room.capacity.adults || 0) + (room.capacity.children || 0)) * sel.count;
      roomNames.push(room.name);

      // Pricing
      const perRoomPrice = room.getPriceForDates(checkIn, checkOut);
      roomPrice += (perRoomPrice * sel.count);

      // Physical Allocation (find available internal room numbers)
      const availableRNs = await RoomNumber.find({ roomType: room._id, isActive: true });
      let allocatedForThisType = [];
      for (const rn of availableRNs) {
        if (await rn.isAvailableForDates(allocCheckIn, allocCheckOut)) {
          allocatedForThisType.push(rn);
          if (allocatedForThisType.length === sel.count) break;
        }
      }

      if (allocatedForThisType.length < sel.count) {
        return res.status(400).json({
          success: false,
          message: `Could not allocate enough physical rooms for ${room.name}`
        });
      }

      roomNumberDocsToAllocate.push(...allocatedForThisType);
      bookingRoomsData.push(...allocatedForThisType.map(rn => ({
        roomType: room._id,
        roomNumber: rn._id,
        roomNumberInfo: { number: rn.roomNumber, floor: rn.floor },
        price: perRoomPrice
      })));
    }

    // Guest capacity validation
    const totalAdults = Number(guestDetails.totalAdults || 0);
    const totalChildren = Number(guestDetails.totalChildren || 0);
    if (totalAdults + totalChildren > totalMaxCapacity) {
      return res.status(400).json({
        success: false,
        message: `Total capacity (max ${totalMaxCapacity}) exceeded for selected rooms.`
      });
    }

    // Subtotal and Discounts
    let subtotal = roomPrice + (extraServices?.reduce((sum, s) => sum + (s.price * s.quantity), 0) || 0);
    let discountAmount = 0;
    let appliedDiscount = null;

    if (discountCode) {
      const discount = await Discount.findOne({ code: discountCode.toUpperCase(), isActive: true });
      if (discount && discount.validFrom <= new Date() && discount.validUntil >= new Date()) {
        if (subtotal < discount.minimumOrderAmount) {
          // If called during booking creation, we still want to apply if it passes, 
          // but if it fails we don't apply it.
          // No error returned here as it's often a silent check during creation if code was pre-filled
          console.log(`Discount code ${discountCode} not applied: min amount ₹${discount.minimumOrderAmount} not met.`);
        } else if (discount.maximumOrderAmount && subtotal > discount.maximumOrderAmount) {
          console.log(`Discount code ${discountCode} not applied: max amount ₹${discount.maximumOrderAmount} exceeded.`);
        } else {
          discountAmount = discount.calculateDiscount(subtotal);
          appliedDiscount = {
            discountId: discount._id,
            code: discount.code,
            name: discount.name,
            type: discount.type,
            value: discount.value,
            amount: discountAmount
          };
        }
      }
    }

    // Taxes (GST)
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ type: 'tax' });
    const gstRate = settings ? settings.gstPercentage : 18;
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const gst = subtotalAfterDiscount * (gstRate / 100);
    const totalAmount = subtotalAfterDiscount + gst;

    // Create Booking
    const booking = await Booking.create({
      user: req.user.id,
      rooms: bookingRoomsData,
      guestDetails,
      bookingDates: { checkInDate: allocCheckIn, checkOutDate: allocCheckOut, nights },
      pricing: {
        roomPrice: roomPrice,
        extraServices: extraServices || [],
        subtotal,
        discount: appliedDiscount ? {
          couponCode: appliedDiscount.code,
          amount: discountAmount,
          percentage: appliedDiscount.type === 'percentage' ? appliedDiscount.value : 0
        } : { couponCode: null, amount: 0, percentage: 0 },
        taxes: { gst },
        totalAmount
      },
      specialRequests,
      preferences: preferences || {},
      status: "Pending", // Direct creation as pending
      paymentDetails: {
        method: paymentDetails?.method || "Cash",
        transactionId: paymentDetails?.transactionId || null,
        paidAmount: paymentDetails?.method !== "Cash" ? totalAmount : 0,
        paymentDate: paymentDetails?.method !== "Cash" ? new Date() : null,
      },
    });

    // Finalize Allocations (create RoomAllocation records)
    for (const rn of roomNumberDocsToAllocate) {
      await RoomAllocation.create({
        booking: booking._id,
        roomNumber: rn._id,
        roomType: rn.roomType,
        guestName: guestDetails.primaryGuest.name,
        checkInDate: allocCheckIn,
        checkOutDate: allocCheckOut,
        status: 'Active'
      });
      // Lock room if check-in is today
      const now = new Date();
      if (allocCheckIn <= now && allocCheckOut > now) {
        await rn.allocate(booking._id, req.user.id, guestDetails.primaryGuest.name, allocCheckIn, allocCheckOut);
      }
    }

    // Discount usage count
    if (appliedDiscount) {
      try {
        await Discount.findByIdAndUpdate(appliedDiscount.discountId, {
          $push: { usedBy: { user: req.user.id, usedAt: new Date(), orderAmount: subtotal, discountAmount } },
          $inc: { usageCount: 1 }
        });
      } catch (err) {
        console.error('Error updating discount usage:', err);
      }
    }

    // Create comprehensive payment record
    let payment = null;
    try {
      const paymentMethod = paymentDetails?.method || "Cash";
      const normalizedPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod.trim() : paymentMethod;
      const isCashPayment = normalizedPaymentMethod.toLowerCase() === "cash";

      const razorpayMethods = ['netbanking', 'wallet', 'card', 'upi', 'emi', 'cardless_emi', 'paylater'];
      const isRazorpay = razorpayMethods.includes(normalizedPaymentMethod.toLowerCase());

      const paymentDetailsObj = {};
      if (['card', 'Card'].includes(normalizedPaymentMethod)) {
        paymentDetailsObj.cardLast4 = paymentDetails.cardLast4 || null;
        paymentDetailsObj.cardBrand = paymentDetails.cardBrand || null;
      } else if (normalizedPaymentMethod.toLowerCase() === 'upi') {
        paymentDetailsObj.upiId = paymentDetails.upiId || null;
      }

      payment = await Payment.create({
        booking: booking._id,
        user: req.user.id,
        amount: totalAmount,
        currency: 'INR',
        paymentMethod: normalizedPaymentMethod,
        gateway: isRazorpay ? "Razorpay" : "Manual",
        status: "Completed",
        transactionId: paymentDetails?.transactionId || (isCashPayment ? `CASH_${booking._id}` : `TXN${Date.now()}`),
        paymentDetails: paymentDetailsObj,
        billingAddress: {
          firstName: guestDetails.primaryGuest.name.split(' ')[0] || '',
          lastName: guestDetails.primaryGuest.name.split(' ').slice(1).join(' ') || '',
          email: guestDetails.primaryGuest.email,
          phone: guestDetails.primaryGuest.phone
        },
        description: `Payment for booking ${booking.bookingId} - ${roomNames.join(', ')}`,
        paymentDate: new Date(),
        taxes: { gst, serviceTax: 0, other: 0 },
        metadata: {
          bookingId: booking.bookingId,
          roomNames: roomNames.join(', '),
          nights,
          discountApplied: !!appliedDiscount
        }
      });

      booking.paymentStatus = "Paid";
      booking.paymentDetails.paymentId = payment._id;
      await booking.save();
    } catch (paymentError) {
      console.error("Payment record creation error:", paymentError);
    }

    // Populate for communications
    await booking.populate([
      { path: "user", select: "name email phone" },
      { path: "rooms.roomType", select: "name type" }
    ]);

    // Send confirmation email
    try {
      const htmlMessage = generateBookingReceivedEmail(booking);
      const plainTextMessage = `Dear ${guestDetails.primaryGuest.name},\n\nYour booking ${booking.bookingId} for ${roomNames.join(', ')} has been received and is pending confirmation.`;

      sendEmail({
        email: guestDetails.primaryGuest.email,
        subject: `⏳ Booking Received - Pending Confirmation - ${booking.bookingId} | Luxury Hotel`,
        message: plainTextMessage,
        html: htmlMessage,
      }).catch(err => console.error("Email sending error:", err));
    } catch (e) {
      console.error("Email preparation error:", e);
    }

    // Real-time notifications
    try {
      emitNewBooking({
        bookingId: booking.bookingId,
        customerName: guestDetails.primaryGuest.name,
        roomName: roomNames.length > 1 ? `${roomNames.length} Room Types` : roomNames[0],
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      });

      await createRoomBookingNotification(
        req.user.id,
        { booking, rooms: booking.rooms, status: booking.status },
        'created'
      );

      emitRoomNumbersChange();

      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await createRoomBookingNotification(
          admin._id,
          { booking, rooms: booking.rooms, status: booking.status },
          'created_admin'
        ).catch(() => { });
      }
    } catch (notifErr) {
      console.error("Notification emission error:", notifErr);
    }

    res.status(201).json({
      success: true,
      data: booking,
      bookingId: booking.bookingId,
      paymentId: payment?._id || null,
      message: "Booking created successfully and is pending admin confirmation",
    });

  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error",
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
      .populate("rooms.roomType", "_id id name type images")
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
      .populate("rooms.roomType", "_id id name type images")
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
      .populate("rooms.roomType", "name type images amenities features")
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
      let subtotal = booking.pricing.roomPrice;

      if (updates.extraServices) {
        subtotal = booking.pricing.roomPrice;
        updates.extraServices.forEach((service) => {
          subtotal += service.price * service.quantity;
        });
      }


      // Fetch dynamic GST
      const Settings = require('../models/Settings');
      const settings = await Settings.findOne({ type: 'tax' });
      const gstRate = settings ? settings.gstPercentage : 18;

      const gst = subtotal * (gstRate / 100);
      updates["pricing.subtotal"] = subtotal;
      updates["pricing.taxes.gst"] = gst;
      updates["pricing.totalAmount"] = subtotal + gst;
    }

    booking = await Booking.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("rooms.roomType", "name type");

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
    console.log('Cancel booking request received:', {
      bookingId: req.params.id,
      userId: req.user.id,
      userRole: req.user.role,
      reason: req.body.reason
    });

    const { reason } = req.body;

    // Validate ObjectId format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('Invalid booking ID format:', req.params.id);
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
      });
    }

    const booking = await Booking.findById(req.params.id);
    console.log('Found booking:', booking ? 'Yes' : 'No');
    console.log('Booking status:', booking?.status);
    console.log('Booking user:', booking?.user?.toString());

    if (!booking) {
      console.log('Booking not found for ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking or is admin
    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      console.log('Authorization failed - user does not own booking');
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
      });
    }

    // Check if booking can be cancelled
    const canCancel = booking.canBeCancelled();
    console.log('Can cancel booking:', canCancel);
    console.log('Booking check-in date:', booking.bookingDates.checkInDate);
    console.log('Current time:', new Date());

    if (!canCancel) {
      console.log('Booking cannot be cancelled - status:', booking.status);
      return res.status(400).json({
        success: false,
        message: "Booking cannot be cancelled at this time",
      });
    }

    // Calculate cancellation fee
    const cancellationFee = booking.calculateCancellationFee();
    let refundAmount = booking.pricing.totalAmount - cancellationFee;

    // For Cash bookings, no online refund is needed since payment wasn't collected online
    const paymentMethod = booking.paymentDetails?.method || '';
    const isCashPayment = paymentMethod.toLowerCase() === 'cash';
    if (isCashPayment) {
      refundAmount = 0;
    }

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

    // Update all rooms status to Cancelled
    booking.rooms.forEach(room => {
      room.status = 'Cancelled';
    });

    // Deallocate all room numbers for this booking
    const RoomAllocation = require('../models/RoomAllocation');

    for (const roomItem of booking.rooms) {
      if (roomItem.roomNumber) {
        try {
          const roomNumberDoc = await RoomNumber.findById(roomItem.roomNumber);
          if (roomNumberDoc) {
            await roomNumberDoc.deallocate();
            console.log(`Room number ${roomNumberDoc.roomNumber} deallocated`);
          }

          // Cancel the RoomAllocation record
          await RoomAllocation.findOneAndUpdate(
            { booking: booking._id, roomNumber: roomItem.roomNumber, status: 'Active' },
            { status: 'Cancelled' }
          );
        } catch (roomError) {
          console.error(`Error deallocating room number ${roomItem.roomNumber}:`, roomError);
        }
      }
    }

    // Safety net: ensure ALL remaining Active allocations for this booking are cancelled
    await RoomAllocation.updateMany(
      { booking: booking._id, status: 'Active' },
      { status: 'Cancelled' }
    );

    await booking.save();

    // Send cancellation email
    try {
      const htmlMessage = generateCancellationEmail(booking, cancellationFee, refundAmount);

      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `❌ Booking Cancelled - ${booking.bookingId} | Luxury Hotel`,
        message: `Your booking ${booking.bookingId} has been cancelled.`, // Plain text fallback
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
    }

    // Create notification in database and emit socket event via controller
    const mainRoomType = booking.rooms[0]?.roomType;
    if (mainRoomType && typeof createRoomBookingNotification === 'function') {
      const bookingOwnerId = booking.user.toString();
      const notifiedUserIds = new Set();

      await createRoomBookingNotification(
        bookingOwnerId,
        { booking, room: mainRoomType, status: 'Cancelled' },
        req.user.role === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_user'
      );
      notifiedUserIds.add(bookingOwnerId);

      if (req.user.role !== 'admin') {
        const admins = await User.find({ role: 'admin' });
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            const adminId = admin._id.toString();
            if (notifiedUserIds.has(adminId)) continue;

            try {
              await createRoomBookingNotification(
                admin._id,
                { booking, room: mainRoomType, status: 'Cancelled' },
                'cancelled_by_user'
              );
              notifiedUserIds.add(adminId);
            } catch (err) { console.error(`Failed to notify admin ${admin._id}`, err); }
          }
        }
      }
    }
    console.log('Notifications sent successfully');

    emitBookingStatusChange(booking.bookingId, 'Cancelled', booking.user.toString());
    emitRoomNumbersChange();

    res.status(200).json({
      success: true,
      data: booking,
      message: "Booking cancelled successfully"
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
};

// @desc    Partial cancel booking (cancel specific rooms)
// @route   PUT /api/bookings/:id/partial-cancel
// @access  Private
const partialCancelBooking = async (req, res) => {
  try {
    const { roomNumberIds, reason } = req.body; // Array of RoomNumber database IDs

    if (!roomNumberIds || !Array.isArray(roomNumberIds) || roomNumberIds.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide room numbers to cancel" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check ownership/admin
    if (booking.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Filter out already cancelled rooms or invalid ones
    let roomsToCancel = booking.rooms.filter(r => roomNumberIds.includes(r.roomNumber.toString()) && r.status !== 'Cancelled');

    if (roomsToCancel.length === 0) {
      return res.status(400).json({ success: false, message: "No valid active rooms found for cancellation" });
    }

    // If all rooms are being cancelled, use full cancellation logic (or handle it here)
    const activeRoomsCount = booking.rooms.filter(r => r.status !== 'Cancelled').length;

    if (roomsToCancel.length === activeRoomsCount) {
      return cancelBooking(req, res);
    }

    // Mark rooms as cancelled in the booking record
    booking.rooms.forEach(r => {
      if (roomNumberIds.includes(r.roomNumber.toString())) {
        r.status = 'Cancelled';
      }
    });

    // Deallocate room numbers
    const RoomAllocation = require('../models/RoomAllocation');
    for (const roomItem of roomsToCancel) {
      try {
        const roomNumberDoc = await RoomNumber.findById(roomItem.roomNumber);
        if (roomNumberDoc) {
          await roomNumberDoc.deallocate();
        }
        await RoomAllocation.findOneAndUpdate(
          { booking: booking._id, roomNumber: roomItem.roomNumber },
          { status: 'Cancelled' }
        );
      } catch (err) {
        console.error(`Error partial deallocating:`, err);
      }
    }

    // Recalculate total amount
    booking.calculateTotalAmount();
    
    // Set partial cancellation flag but KEEP original status (Pending, Confirmed, etc.)
    // This allows standard dashboard actions to remain available based on primary status.
    booking.isPartiallyCancelled = true;

    await booking.save();

    // Send Email Notification
    try {
      const activeRoomsCount = booking.rooms.filter(r => r.status !== 'Cancelled').length;
      const cancelledRoomsCount = roomsToCancel.length;
      const htmlMessage = generatePartialCancellationEmail(booking, cancelledRoomsCount, activeRoomsCount);

      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `⚠️ Partial Cancellation - ${booking.bookingId} | Luxury Hotel`,
        message: `Your booking ${booking.bookingId} has been partially cancelled. ${cancelledRoomsCount} room(s) cancelled.`,
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Partial cancellation email error:", emailError);
    }

    // Create notification and emit socket events
    try {
      const mainRoomType = booking.rooms[0]?.roomType;
      await createRoomBookingNotification(
        booking.user.toString(),
        { booking, room: mainRoomType, status: 'PartiallyCancelled' },
        req.user.role === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_user'
      );
      
      emitBookingStatusChange(booking.bookingId, 'PartiallyCancelled', booking.user.toString());
      emitRoomNumbersChange();
    } catch (notifError) {
      console.error("Partial cancellation notification error:", notifError);
    }

    res.status(200).json({
      success: true,
      data: booking,
      message: `${roomsToCancel.length} room(s) cancelled successfully`
    });

  } catch (error) {
    console.error("Partial cancel error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm booking (Admin only)
// @route   PUT /api/bookings/:id/confirm
// @access  Private/Admin
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('rooms.roomType')
      .populate('user', 'name email');

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm booking with status: ${booking.status}. Only Pending bookings can be confirmed.`,
      });
    }

    booking.status = "Confirmed";

    // Automatically allocate rooms if not already done
    try {
      await autoAllocateRooms(booking);
    } catch (allocError) {
      console.error("Automatic allocation failed during confirmation:", allocError);
    }

    await booking.save();

    try {
      const htmlMessage = generateBookingConfirmationEmail(booking);
      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `✅ Booking Confirmed - ${booking.bookingId} | Luxury Hotel`,
        message: `Your booking ${booking.bookingId} has been confirmed!`,
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Confirmation email sending error:", emailError);
    }

    try {
      const mainRoomType = booking.rooms[0]?.roomType;
      await createRoomBookingNotification(
        booking.user._id.toString(),
        { booking, room: mainRoomType, status: 'Confirmed' },
        'confirmed_by_admin'
      );
      emitBookingStatusChange(booking.bookingId, 'Confirmed', booking.user._id.toString());
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error("Confirm booking error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


// @desc    Check-in booking (Admin/Staff only)
// @route   PUT /api/bookings/:id/checkin
// @access  Private/Admin
const checkInBooking = async (req, res) => {
  try {
    const { identityProof, notes } = req.body;

    const booking = await Booking.findById(req.params.id)
      .populate('rooms.roomType')
      .populate('user');

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "Confirmed") {
      return res.status(400).json({ success: false, message: "Only confirmed bookings can be checked in" });
    }

    booking.status = "CheckedIn";
    booking.checkInDetails = {
      actualCheckInTime: new Date(),
      frontDeskStaff: req.user.id,
      identityProof,
      notes,
    };

    // Update all assigned room numbers status to Occupied
    for (const roomItem of booking.rooms) {
      if (roomItem.roomNumber) {
        try {
          const roomNumber = await RoomNumber.findById(roomItem.roomNumber);
          if (roomNumber) {
            await roomNumber.markOccupied(new Date());
          }
        } catch (err) {
          console.error(`Error updating room status for ${roomItem.roomNumberInfo.number}:`, err);
        }
      }
    }

    await booking.save();

    try {
      const htmlMessage = generateCheckInEmail(booking, booking.checkInDetails);
      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `Welcome! Check - In Confirmed - ${booking.bookingId} | Luxury Hotel`,
        message: `Welcome to Luxury Hotel! You have successfully checked in.`,
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Check-in email sending error:", emailError);
    }

    // Create notification and emit socket event for check-in
    try {
      const userId = booking.user._id ? booking.user._id.toString() : booking.user.toString();
      const mainRoomType = booking.rooms[0]?.roomType;
      await createRoomBookingNotification(
        userId,
        { booking, room: mainRoomType, rooms: booking.rooms, status: 'CheckedIn' },
        'checked_in'
      );
      emitBookingStatusChange(booking.bookingId, 'CheckedIn', userId);
    } catch (notificationError) {
      console.error("Check-in notification error:", notificationError);
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Check-out booking (Admin/Staff only)
// @route   PUT /api/bookings/:id/checkout
// @access  Private/Admin
const checkOutBooking = async (req, res) => {
  try {
    const { roomCondition, additionalCharges, notes } = req.body;

    const booking = await Booking.findById(req.params.id)
      .populate('rooms.roomType')
      .populate('user');

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "CheckedIn") {
      return res.status(400).json({ success: false, message: "Only checked-in bookings can be checked out" });
    }

    booking.status = "CheckedOut";
    booking.checkOutDetails = {
      actualCheckOutTime: new Date(),
      frontDeskStaff: req.user.id,
      roomCondition,
      additionalCharges: additionalCharges || [],
      notes,
    };

    if (additionalCharges && additionalCharges.length > 0) {
      const additionalTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
      booking.pricing.totalAmount += additionalTotal;
    }

    // Deallocate all room numbers and update RoomAllocation records
    const RoomAllocationModel = require('../models/RoomAllocation');
    for (const roomItem of booking.rooms) {
      if (roomItem.roomNumber) {
        try {
          const roomNumber = await RoomNumber.findById(roomItem.roomNumber);
          if (roomNumber) {
            await roomNumber.deallocate();
          }

          // Mark the RoomAllocation record as Completed for this specific room
          await RoomAllocationModel.findOneAndUpdate(
            { booking: booking._id, roomNumber: roomItem.roomNumber, status: 'Active' },
            { status: 'Completed' }
          );
        } catch (err) {
          console.error(`Error deallocating room ${roomItem.roomNumberInfo?.number || roomItem.roomNumber}:`, err);
        }
      }
    }

    // Also update any remaining Active allocations for this booking (safety net)
    await RoomAllocationModel.updateMany(
      { booking: booking._id, status: 'Active' },
      { status: 'Completed' }
    );

    await booking.save();

    try {
      const htmlMessage = generateCheckOutEmail(booking, booking.checkOutDetails);
      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `🏁 Check - Out Complete - Thank You! ${booking.bookingId} | Luxury Hotel`,
        message: `Thank you for staying with Luxury Hotel! Your check-out has been processed.`,
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Check-out email sending error:", emailError);
    }

    // Create notification and emit socket event for check-out
    try {
      const userId = booking.user._id ? booking.user._id.toString() : booking.user.toString();
      const mainRoomType = booking.rooms[0]?.roomType;
      await createRoomBookingNotification(
        userId,
        { booking, room: mainRoomType, rooms: booking.rooms, status: 'CheckedOut' },
        'checked_out'
      );
      emitBookingStatusChange(booking.bookingId, 'CheckedOut', userId);
    } catch (notificationError) {
      console.error("Check-out notification error:", notificationError);
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Create offline booking (Admin)
// @route   POST /api/bookings/offline
// @access  Private/Admin
const createOfflineBooking = async (req, res) => {
  try {
    const {
      customerDetails, // { name, email, phone }
      roomId, // Legacy support
      rooms: inputRooms, // [{ roomId, adults, children }]
      checkInDate,
      checkOutDate,
      guestDetails,
      paymentDetails, // { amount, method: 'Cash'|'Card'|'Razorpay' }
      status = 'Confirmed'
    } = req.body;

    // Normalize rooms - handle either roomId or rooms array
    let roomsToBook = [];
    if (inputRooms && inputRooms.length > 0) {
      roomsToBook = inputRooms;
    } else if (roomId) {
      roomsToBook = [{
        roomId,
        adults: guestDetails?.totalAdults || 1,
        children: guestDetails?.totalChildren || 0
      }];
    }

    if (roomsToBook.length === 0) {
      return res.status(400).json({ success: false, message: "No rooms selected" });
    }

    // 1. Find or Create User
    let user = await User.findOne({
      $or: [
        { email: customerDetails.email },
        { phone: customerDetails.phone }
      ]
    });

    if (!user) {
      const generatedPassword = Math.random().toString(36).slice(-8);
      user = await User.create({
        name: customerDetails.name,
        email: customerDetails.email || `walkin_${Date.now()}@hotel.com`,
        phone: customerDetails.phone,
        password: generatedPassword,
        role: 'customer',
        authProvider: 'local',
        isEmailVerified: true
      });
    }

    const checkIn = new Date(checkInDate);
    checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(checkOutDate);
    checkOut.setUTCHours(0, 0, 0, 0);
    const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // 2. Process all rooms and calculate pricing
    let finalRooms = [];
    let subtotal = 0;
    let roomNames = [];
    let roomNumberDocs = [];

    for (const roomItem of roomsToBook) {
      const room = await Room.findById(roomItem.roomId);
      if (!room) {
        return res.status(404).json({ success: false, message: `Room type ${roomItem.roomId} not found` });
      }

      // Find available room number excluding already selected ones
      const allTypeRooms = await RoomNumber.find({ roomType: roomItem.roomId, isActive: true });
      let availableRoomNumber = null;
      for (const rn of allTypeRooms) {
        if (!roomNumberDocs.map(d => d._id.toString()).includes(rn._id.toString())) {
          if (await rn.isAvailableForDates(checkIn, checkOut)) {
            availableRoomNumber = rn;
            break;
          }
        }
      }

      if (!availableRoomNumber) {
        return res.status(400).json({ success: false, message: `No available rooms of type ${room.name} for selected dates` });
      }
      roomNumberDocs.push(availableRoomNumber);

      const roomPrice = room.getPriceForDates(checkIn, checkOut);
      subtotal += roomPrice;
      roomNames.push(room.name);

      // Validate individual room capacity
      if (Number(roomItem.adults) > room.capacity.adults) {
        return res.status(400).json({ success: false, message: `Room ${room.name} exceeds max adults per room (${room.capacity.adults})` });
      }
      if (Number(roomItem.children) > room.capacity.children) {
        return res.status(400).json({ success: false, message: `Room ${room.name} exceeds max children per room (${room.capacity.children})` });
      }

      finalRooms.push({
        roomType: roomItem.roomId,
        roomNumber: availableRoomNumber._id,
        roomNumberInfo: {
          number: availableRoomNumber.roomNumber,
          floor: availableRoomNumber.floor
        },
        adults: Number(roomItem.adults),
        children: Number(roomItem.children),
        price: roomPrice,
        status: status === 'Cancelled' ? 'Cancelled' : 'Confirmed'
      });
    }

    // Fetch dynamic GST
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ type: 'tax' });
    const gstRate = settings ? settings.gstPercentage : 18;
    const gst = subtotal * (gstRate / 100);
    const totalAmount = subtotal + gst;

    // 3. Create Booking
    const booking = await Booking.create({
      user: user._id,
      rooms: finalRooms,
      guestDetails: {
        primaryGuest: {
          name: customerDetails.name,
          email: customerDetails.email || user.email,
          phone: customerDetails.phone
        },
        totalAdults: guestDetails?.totalAdults || roomsToBook.reduce((acc, r) => acc + (r.adults || 0), 0),
        totalChildren: guestDetails?.totalChildren || roomsToBook.reduce((acc, r) => acc + (r.children || 0), 0)
      },
      bookingDates: {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights
      },
      pricing: {
        roomPrice: subtotal,
        subtotal,
        taxes: { gst },
        totalAmount,
        extraServices: []
      },
      status: status,
      paymentStatus: paymentDetails.method === 'Cash' ? 'Paid' : 'Pending',
      paymentDetails: {
        method: paymentDetails.method,
        amount: totalAmount,
        paymentDate: paymentDetails.method === 'Cash' ? new Date() : null
      }
    });

    // 4. Room Allocation for all rooms
    try {
      const now = new Date();
      const isActiveNow = (checkIn <= now && checkOut > now);

      for (let i = 0; i < finalRooms.length; i++) {
        const roomItem = finalRooms[i];
        const rn = roomNumberDocs[i];

        await RoomAllocation.create({
          booking: booking._id,
          roomNumber: rn._id,
          roomType: roomItem.roomType,
          guestName: customerDetails.name,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          status: 'Active'
        });

        if (isActiveNow && (status === 'Confirmed' || status === 'CheckedIn')) {
          await rn.allocate(
            booking._id,
            user._id,
            customerDetails.name,
            checkIn,
            checkOut
          );

          if (status === 'CheckedIn') {
            await rn.markOccupied(new Date());
          }
        }
      }
    } catch (allocError) {
      console.error("Allocation error during offline booking:", allocError);
    }

    // 5. Emit Events
    emitNewBooking({
      bookingId: booking.bookingId,
      customerName: customerDetails.name,
      roomName: roomNames.join(', '),
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalAmount,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    });

    // 6. Send Confirmation Email
    if (customerDetails.email) {
      try {
        const message = `
          Dear ${customerDetails.name},

          Your offline booking has been successfully confirmed.

          Booking ID: ${booking.bookingId}
          Rooms: ${roomNames.join(', ')}
          Check-in: ${new Date(checkIn).toLocaleDateString()}
          Check-out: ${new Date(checkOut).toLocaleDateString()}
          Total Amount: ₹${totalAmount.toFixed(2)}
          Payment Status: ${booking.paymentStatus}

          Thank you for staying with us!
        `;

        await sendEmail({
          email: customerDetails.email,
          subject: `Booking Confirmed - ${booking.bookingId}`,
          message
        });
      } catch (emailError) {
        console.error("Failed to send booking confirmation email:", emailError);
      }
    }

    res.status(201).json({
      success: true,
      data: booking,
      message: "Offline booking created successfully"
    });

  } catch (error) {
    console.error("Create offline booking error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper to automatically allocate room numbers to a booking if not already assigned
 * @param {Object} booking - The booking document
 * @returns {Promise<Boolean>} - True if all rooms were allocated
 */
const autoAllocateRooms = async (booking) => {
  try {
    const RoomNumber = require("../models/RoomNumber");
    const RoomAllocation = require("../models/RoomAllocation");
    const { emitRoomNumbersChange } = require("../config/socket");

    const checkIn = new Date(booking.bookingDates.checkInDate);
    checkIn.setUTCHours(0, 0, 0, 0);
    const checkOut = new Date(booking.bookingDates.checkOutDate);
    checkOut.setUTCHours(0, 0, 0, 0);

    let allocationsMade = 0;

    for (let roomItem of booking.rooms) {
      if (roomItem.status === 'Cancelled' || roomItem.roomNumber) continue;

      // Find available room numbers for this type
      const availableRNs = await RoomNumber.find({
        roomType: roomItem.roomType,
        isActive: true
      });

      let found = false;
      for (const rn of availableRNs) {
        // Check if this room number is available for the dates
        if (await rn.isAvailableForDates(checkIn, checkOut)) {
          // Double check if we already picked this room for another room in the SAME booking list being processed
          const alreadyPicked = booking.rooms.some(r => r.roomNumber && r.roomNumber.toString() === rn._id.toString());
          if (!alreadyPicked) {
            roomItem.roomNumber = rn._id;
            roomItem.roomNumberInfo = { number: rn.roomNumber, floor: rn.floor };

            // Create RoomAllocation record
            await RoomAllocation.create({
              booking: booking._id,
              roomNumber: rn._id,
              roomType: rn.roomType,
              guestName: booking.guestDetails.primaryGuest.name,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              status: 'Active'
            });

            // Lock room if check-in is today
            const now = new Date();
            if (checkIn <= now && checkOut > now) {
              await rn.allocate(booking._id, booking.user, booking.guestDetails.primaryGuest.name, checkIn, checkOut);
            }

            allocationsMade++;
            found = true;
            break;
          }
        }
      }
    }

    if (allocationsMade > 0) {
      await booking.save();
      try { emitRoomNumbersChange(); } catch (e) { }
    }

    return true;
  } catch (err) {
    console.error("Auto-allocation error:", err);
    return false;
  }
};

/**
 * @desc    Manually trigger automatic room allocation for a booking
 * @route   PUT /api/bookings/:id/auto-allocate
 * @access  Private (Admin/Staff)
 */
const triggerAutoAllocation = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const success = await autoAllocateRooms(booking);
    if (success) {
      res.status(200).json({
        success: true,
        message: "Rooms allocated successfully",
        data: booking
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Could not allocate all rooms automatically. Some rooms may still be without room numbers."
      });
    }
  } catch (error) {
    console.error("Trigger auto-allocation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  validateDiscountForBooking,
  createBooking,
  createOfflineBooking,
  getBookings,
  getAllBookings,
  getBooking,
  updateBooking,
  cancelBooking,
  partialCancelBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  triggerAutoAllocation
};
