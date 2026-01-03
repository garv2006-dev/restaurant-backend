const Booking = require("../models/Booking");
const Room = require("../models/Room");
const User = require("../models/User");
const Payment = require("../models/Payment");
const Discount = require("../models/Discount");
const sendEmail = require("../utils/sendEmail");
const { generateBookingConfirmationEmail, generateCancellationEmail } = require("../utils/emailTemplates");
const { awardPointsForBooking } = require("./loyaltyController");
const {
  emitNewBooking,
  emitBookingStatusChange,
  emitUserNotification,
} = require("../config/socket");
const { createRoomBookingNotification, createPaymentNotification } = require("./notificationController");

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
        message: `Minimum booking amount of ₹${discount.minimumOrderAmount} required`
      });
    }

    // Check maximum order amount
    if (discount.maximumOrderAmount && subtotal > discount.maximumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Maximum booking amount of ₹${discount.maximumOrderAmount} exceeded`
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
          value: discount.value
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
      roomId,
      checkInDate,
      checkOutDate,
      guestDetails,
      specialRequests,
      preferences,
      extraServices,
      paymentDetails,
      discountCode, // New field for discount
    } = req.body;

    // Find room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Validate guest capacity
    const totalGuests = (guestDetails.totalAdults || 0) + (guestDetails.totalChildren || 0);
    const maxCapacity = (room.capacity.adults || 0) + (room.capacity.children || 0);
    
    if (totalGuests > maxCapacity) {
      return res.status(400).json({
        success: false,
        message: `Room capacity exceeded. This room can accommodate maximum ${maxCapacity} guests (${room.capacity.adults} adults + ${room.capacity.children} children). You selected ${totalGuests} guests.`,
      });
    }

    if (guestDetails.totalAdults < 1) {
      return res.status(400).json({
        success: false,
        message: "At least one adult is required for booking",
      });
    }

    if (guestDetails.totalAdults > room.capacity.adults) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${room.capacity.adults} adults allowed for this room`,
      });
    }

    if (guestDetails.totalChildren > room.capacity.children) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${room.capacity.children} children allowed for this room`,
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

    // Handle discount application
    let appliedDiscount = null;
    let discountAmount = 0;
    
    if (discountCode) {
      try {
        // Find and validate discount
        const discount = await Discount.findOne({ 
          code: discountCode.toUpperCase(),
          isActive: true 
        });

        if (!discount) {
          return res.status(400).json({
            success: false,
            message: "Invalid discount code",
          });
        }

        // Validate discount eligibility
        const now = new Date();
        if (discount.validFrom > now || discount.validUntil < now) {
          return res.status(400).json({
            success: false,
            message: "Discount code has expired",
          });
        }

        if (discount.usageLimit.total !== null && discount.usageCount >= discount.usageLimit.total) {
          return res.status(400).json({
            success: false,
            message: "Discount code has reached its usage limit",
          });
        }

        if (!discount.canUserUse(req.user.id)) {
          return res.status(400).json({
            success: false,
            message: "You have already used this discount code or are not eligible",
          });
        }

        if (subtotal < discount.minimumOrderAmount) {
          return res.status(400).json({
            success: false,
            message: `Minimum booking amount of ₹${discount.minimumOrderAmount} required`,
          });
        }

        if (discount.maximumOrderAmount && subtotal > discount.maximumOrderAmount) {
          return res.status(400).json({
            success: false,
            message: `Maximum booking amount of ₹${discount.maximumOrderAmount} exceeded`,
          });
        }

        // Calculate discount
        discountAmount = discount.calculateDiscount(subtotal);
        
        if (discountAmount > 0) {
          appliedDiscount = {
            discountId: discount._id,
            code: discount.code,
            name: discount.name,
            type: discount.type,
            value: discount.value,
            amount: discountAmount
          };
        }
      } catch (discountError) {
        console.error('Discount validation error:', discountError);
        return res.status(400).json({
          success: false,
          message: "Error applying discount code",
        });
      }
    }

    // Calculate final amounts
    const subtotalAfterDiscount = subtotal - discountAmount;
    const gst = subtotalAfterDiscount * 0.18;
    const totalAmount = subtotalAfterDiscount + gst;

    // Ensure total amount is not negative
    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount after discount",
      });
    }

    // Create booking with discount information
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
        discount: appliedDiscount ? {
          couponCode: appliedDiscount.code,
          amount: discountAmount,
          percentage: appliedDiscount.type === 'percentage' ? appliedDiscount.value : 0
        } : {
          couponCode: null,
          amount: 0,
          percentage: 0
        },
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

    // If discount was applied, record its usage
    if (appliedDiscount) {
      try {
        const discount = await Discount.findById(appliedDiscount.discountId);
        if (discount) {
          discount.usedBy.push({
            user: req.user.id,
            usedAt: new Date(),
            orderAmount: subtotal,
            discountAmount: discountAmount
          });
          discount.usageCount += 1;
          await discount.save();
        }
      } catch (discountUpdateError) {
        console.error('Error updating discount usage:', discountUpdateError);
        // Continue with booking creation even if discount update fails
      }
    }

    // Create payment record automatically with comprehensive details
    let payment = null;
    try {
      const paymentMethod = paymentDetails?.method || "Cash";
      const normalizedPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod.trim() : paymentMethod;
      const isCashPayment = normalizedPaymentMethod === "Cash" || normalizedPaymentMethod === "cash" || normalizedPaymentMethod === "COD";
      
      // Build payment details object based on payment method
      const paymentDetailsObj = {};
      
      if (normalizedPaymentMethod === "Card") {
        // Store card payment details
        paymentDetailsObj.cardLast4 = paymentDetails.cardLast4 || null;
        paymentDetailsObj.cardBrand = paymentDetails.cardBrand || null;
        paymentDetailsObj.cardHolderName = paymentDetails.cardHolderName || null;
      } else if (normalizedPaymentMethod === "UPI") {
        // Store UPI payment details
        paymentDetailsObj.upiId = paymentDetails.upiId || null;
      } else if (normalizedPaymentMethod === "Online") {
        // Store online banking details
        paymentDetailsObj.bankName = paymentDetails.bankName || null;
      }
      
      const paymentData = {
        booking: booking._id,
        user: req.user.id,
        amount: totalAmount,
        currency: 'INR',
        paymentMethod: normalizedPaymentMethod,
        method: normalizedPaymentMethod, // Alias field
        gateway: isCashPayment ? "Manual" : "Manual", // Can be updated to actual gateway later
        paymentGateway: isCashPayment ? "Manual" : "Manual",
        status: "Completed", // All payments are completed immediately
        transactionId: paymentDetails?.transactionId || (isCashPayment ? `CASH_${booking._id}` : `TXN${Date.now()}`),
        gatewayTransactionId: paymentDetails?.transactionId || (isCashPayment ? `CASH_${booking._id}` : `TXN${Date.now()}`),
        paymentDetails: paymentDetailsObj,
        billingAddress: {
          firstName: guestDetails.primaryGuest.name.split(' ')[0] || '',
          lastName: guestDetails.primaryGuest.name.split(' ').slice(1).join(' ') || '',
          email: guestDetails.primaryGuest.email,
          phone: guestDetails.primaryGuest.phone
        },
        description: `Payment for booking ${booking.bookingId} - ${room.name} (${nights} nights)`,
        paymentDate: new Date(),
        fees: {
          gatewayFee: 0, // Can be calculated based on payment method
          platformFee: 0,
          processingFee: 0
        },
        taxes: {
          gst: gst,
          serviceTax: 0,
          other: 0
        },
        metadata: {
          bookingId: booking.bookingId,
          roomId: roomId,
          roomName: room.name,
          checkInDate: checkIn.toISOString(),
          checkOutDate: checkOut.toISOString(),
          nights: nights,
          guests: `${guestDetails.totalAdults} adults, ${guestDetails.totalChildren} children`,
          discountApplied: appliedDiscount ? true : false,
          discountCode: appliedDiscount?.code || null,
          discountAmount: discountAmount || 0
        }
      };

      payment = await Payment.create(paymentData);
      console.log('Payment record created successfully:', payment.paymentId);

      // Update booking with payment reference
      // Payment is completed but booking status remains Pending until admin confirms
      booking.paymentStatus = "Paid";
      booking.status = "Pending"; // Changed from "Confirmed" to "Pending"
      booking.paymentDetails.paymentId = payment._id;
      await booking.save();

      // Create payment notification
      try {
        await createPaymentNotification(
          req.user.id,
          {
            payment,
            booking,
            amount: totalAmount,
            method: normalizedPaymentMethod
          },
          'payment_completed'
        );
      } catch (notifError) {
        console.error("Payment notification error:", notifError);
      }
    } catch (paymentError) {
      console.error("Payment creation error:", paymentError);
      console.error("Payment error details:", paymentError.message);
      // Continue even if payment creation fails
    }

    // Populate booking details
    await booking.populate([
      { path: "user", select: "name email phone" },
      { path: "room", select: "name type" },
    ]);

    // Send confirmation email
    try {
      const htmlMessage = generateBookingConfirmationEmail(
        booking, 
        guestDetails, 
        checkIn, 
        checkOut, 
        nights, 
        roomPrice, 
        subtotal, 
        gst, 
        totalAmount, 
        extraServices, 
        specialRequests, 
        paymentDetails
      );

      const plainTextMessage = `
Dear ${guestDetails.primaryGuest.name},

Your booking has been received and is PENDING CONFIRMATION!

BOOKING DETAILS:
- Booking ID: ${booking.bookingId}
- Status: PENDING (Awaiting Admin Confirmation)
- Room: ${booking.room.name} (${booking.room.type})
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
- Room Rate (${nights} nights): ₹${roomPrice.toFixed(2)}${extraServices && extraServices.length > 0 ? `\nExtra Services:\n${extraServices.map(service => `- ${service.name} × ${service.quantity} = ₹${(service.price * service.quantity).toFixed(2)}`).join('\n')}` : ''}
- Subtotal: ₹${subtotal.toFixed(2)}
- GST (18%): ₹${gst.toFixed(2)}
- TOTAL AMOUNT: ₹${totalAmount.toFixed(2)}

PAYMENT INFORMATION:
- Payment Method: ${paymentDetails?.method || 'Cash'}
- Payment Status: ${booking.paymentStatus}
${specialRequests ? `\nSPECIAL REQUESTS:\n${specialRequests}` : ''}

IMPORTANT: Your booking is currently PENDING and will be confirmed by our admin team shortly. You will receive a confirmation email once your booking is approved.

If you need to cancel or modify your booking, please contact us at concierge@luxuryhotel.com or call +1 (555) 123-4567.

Best regards,
Luxury Hotel Booking Team
      `;

      await sendEmail({
        email: guestDetails.primaryGuest.email,
        subject: `⏳ Booking Received - Pending Confirmation - ${booking.bookingId} | Luxury Hotel`,
        message: plainTextMessage,
        html: htmlMessage,
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
        title: "🏨 Booking Created Successfully!",
        message: `Your booking ${booking.bookingId} has been created and is pending admin confirmation`,
        type: "success",
        bookingId: booking.bookingId,
      });

      // Create notification in database
      await createRoomBookingNotification(
        req.user.id,
        { booking, room: booking.room, status: booking.status },
        'created'
      );
    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
    }

    res.status(201).json({
      success: true,
      data: booking,
      bookingId: booking.bookingId,
      paymentId: payment?.paymentId || null,
      message: "Booking created successfully and is pending admin confirmation",
      notificationTrigger: {
        type: 'booking_pending',
        bookingId: booking.bookingId,
        message: `Your booking has been received and is pending confirmation. Booking ID: ${booking.bookingId}`
      }
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
      .populate("room", "_id id name type images")
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
      .populate("room", "_id id name type images")
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
      .populate("room", "name type images amenities features")
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
    }).populate("room", "name type");

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
                Hotel Booking Team
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
      // Check if socket functions are available
      if (typeof emitBookingStatusChange === 'function') {
        emitBookingStatusChange(
          booking.bookingId,
          "Cancelled",
          booking.user.toString()
        );
      }

      if (typeof emitUserNotification === 'function') {
        emitUserNotification(booking.user.toString(), {
          title: "❌ Booking Cancelled",
          message: `Your booking ${booking.bookingId} has been cancelled successfully${refundAmount > 0 ? `. Refund of ₹${refundAmount.toFixed(2)} will be processed within 5-7 business days` : ''}`,
          type: "warning",
          bookingId: booking.bookingId,
        });
      }

      // Create notification in database
      const room = await Room.findById(booking.room);
      if (room && typeof createRoomBookingNotification === 'function') {
        await createRoomBookingNotification(
          booking.user.toString(),
          { booking, room, status: 'Cancelled' },
          req.user.role === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_user'
        );
      }
      console.log('Notifications sent successfully');
    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
      // Don't fail the request if notification fails
    }

    console.log('Cancel booking completed successfully');
    res.status(200).json({
      success: true,
      data: booking,
      message: "Booking cancelled successfully"
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    console.error("Error stack:", error.stack);
    
    // Provide more specific error messages
    let errorMessage = "Server Error";
    if (error.name === 'ValidationError') {
      errorMessage = "Validation Error: " + error.message;
    } else if (error.name === 'CastError') {
      errorMessage = "Invalid booking ID format";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

// @desc    Confirm booking (Admin only)
// @route   PUT /api/bookings/:id/confirm
// @access  Private/Admin
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('user', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if booking is in Pending status
    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm booking with status: ${booking.status}. Only Pending bookings can be confirmed.`,
      });
    }

    // Update booking status to Confirmed
    booking.status = "Confirmed";
    await booking.save();

    // Send confirmation email to customer
    try {
      const checkIn = new Date(booking.bookingDates.checkInDate);
      const checkOut = new Date(booking.bookingDates.checkOutDate);
      const nights = booking.bookingDates.nights;

      const emailMessage = `
Dear ${booking.guestDetails.primaryGuest.name},

Great news! Your booking has been CONFIRMED by our team!

BOOKING DETAILS:
- Booking ID: ${booking.bookingId}
- Status: CONFIRMED ✓
- Room: ${booking.room.name} (${booking.room.type})
- Check-in Date: ${checkIn.toDateString()}
- Check-out Date: ${checkOut.toDateString()}
- Number of Nights: ${nights}
- Total Guests: ${booking.guestDetails.totalAdults} Adult(s), ${booking.guestDetails.totalChildren} Child(ren)

PAYMENT INFORMATION:
- Total Amount: ₹${booking.pricing.totalAmount.toFixed(2)}
- Payment Status: ${booking.paymentStatus}
- Payment Method: ${booking.paymentDetails.method}

We look forward to welcoming you at our hotel!

If you have any questions or need to make changes, please contact us at:
- Email: concierge@luxuryhotel.com
- Phone: +1 (555) 123-4567

Best regards,
Luxury Hotel Team
      `;

      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `✅ Booking Confirmed - ${booking.bookingId} | Luxury Hotel`,
        message: emailMessage,
      });
    } catch (emailError) {
      console.error("Confirmation email sending error:", emailError);
    }

    // Emit real-time notifications
    try {
      // Notify user
      emitUserNotification(booking.user._id.toString(), {
        title: "✅ Booking Confirmed!",
        message: `Your booking ${booking.bookingId} has been confirmed by admin`,
        type: "success",
        bookingId: booking.bookingId,
      });

      // Emit booking status change
      emitBookingStatusChange(
        booking.bookingId,
        "Confirmed",
        booking.user._id.toString()
      );

      // Create notification in database
      await createRoomBookingNotification(
        booking.user._id.toString(),
        { booking, room: booking.room, status: 'Confirmed' },
        'confirmed_by_admin'
      );
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
    }

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Confirm booking error:", error);
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

    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('user');

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

    // Send check-in confirmation email
    try {
      const { generateCheckInEmail } = require("../utils/emailTemplates");
      const htmlMessage = generateCheckInEmail(booking, booking.checkInDetails);

      const plainTextMessage = `
Dear ${booking.guestDetails.primaryGuest.name},

Welcome to Luxury Hotel! You have successfully checked in.

CHECK-IN DETAILS:
- Booking ID: ${booking.bookingId}
- Check-in Date: ${booking.checkInDetails.actualCheckInTime.toDateString()}
- Check-in Time: ${booking.checkInDetails.actualCheckInTime.toLocaleTimeString()}
- Room Type: ${booking.room.type}
- Check-out Date: ${new Date(booking.bookingDates.checkOutDate).toDateString()}

IMPORTANT INFORMATION:
- WiFi Network: LuxuryHotel_Guest
- WiFi Password: Welcome2024
- Check-out Time: 11:00 AM
- Concierge: Dial 0 from your room
- Room Service: Available 24/7 - Dial 1

We hope you enjoy your stay with us!

Best regards,
Luxury Hotel Team
      `;

      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `🏨 Welcome! Check-In Confirmed - ${booking.bookingId} | Luxury Hotel`,
        message: plainTextMessage,
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Check-in email sending error:", emailError);
    }

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

    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('user');

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

    // Send check-out confirmation email
    try {
      const { generateCheckOutEmail } = require("../utils/emailTemplates");
      const htmlMessage = generateCheckOutEmail(booking, booking.checkOutDetails);

      const additionalChargesText = additionalCharges && additionalCharges.length > 0 
        ? `\nADDITIONAL CHARGES:\n${additionalCharges.map(charge => `- ${charge.type}: ${charge.description} - ₹${charge.amount.toFixed(2)}`).join('\n')}`
        : '';

      const additionalTotal = additionalCharges ? additionalCharges.reduce((sum, charge) => sum + charge.amount, 0) : 0;
      const finalTotal = booking.pricing.totalAmount;

      const plainTextMessage = `
Dear ${booking.guestDetails.primaryGuest.name},

Thank you for staying with Luxury Hotel! Your check-out has been processed successfully.

CHECK-OUT DETAILS:
- Booking ID: ${booking.bookingId}
- Check-out Date: ${booking.checkOutDetails.actualCheckOutTime.toDateString()}
- Check-out Time: ${booking.checkOutDetails.actualCheckOutTime.toLocaleTimeString()}
- Room Type: ${booking.room.type}
- Total Nights: ${booking.bookingDates.nights}

FINAL BILL SUMMARY:
- Original Stay Amount: ₹${(finalTotal - additionalTotal).toFixed(2)}${additionalTotal > 0 ? `\n- Additional Charges: ₹${additionalTotal.toFixed(2)}` : ''}
- Final Total: ₹${finalTotal.toFixed(2)}
- Payment Status: ${booking.paymentStatus}${additionalChargesText}

RECEIPT INFORMATION:
This email serves as your official check-out receipt.
For any billing inquiries, please contact our accounting department.

WE VALUE YOUR FEEDBACK:
Please take a moment to share your experience with us.
- Review us on: Google, TripAdvisor, or our website
- Email feedback: feedback@luxuryhotel.com

Thank you for choosing Luxury Hotel. We look forward to welcoming you back!

Best regards,
Luxury Hotel Team
      `;

      await sendEmail({
        email: booking.guestDetails.primaryGuest.email,
        subject: `🏁 Check-Out Complete - Thank You! ${booking.bookingId} | Luxury Hotel`,
        message: plainTextMessage,
        html: htmlMessage,
      });
    } catch (emailError) {
      console.error("Check-out email sending error:", emailError);
    }

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
  validateDiscountForBooking,
  createBooking,
  getBookings,
  getAllBookings,
  getBooking,
  updateBooking,
  cancelBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
};
