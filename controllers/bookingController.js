
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
      discountCode, // Existing discount code field
      redemptionCode, // New redemption code field
    } = req.body;

    // ============================================
    // NIGHT-BASED BOOKING VALIDATION
    // ============================================

    // Validate booking dates for night-only stays
    const dateValidation = validateBookingDates(checkInDate, checkOutDate);
    if (!dateValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: dateValidation.error
      });
    }

    // Find room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Validate guest capacity
    const roomCount = Number(req.body.roomCount || 1);
    const totalAdults = Number(guestDetails.totalAdults || 0);
    const totalChildren = Number(guestDetails.totalChildren || 0);

    const totalGuests = totalAdults + totalChildren;
    const maxCapacityPerRoom = (room.capacity.adults || 0) + (room.capacity.children || 0);
    const totalMaxCapacity = maxCapacityPerRoom * roomCount;

    if (totalGuests > totalMaxCapacity) {
      return res.status(400).json({
        success: false,
        message: `Total capacity exceeded. These ${roomCount} room(s) can accommodate maximum ${totalMaxCapacity} guests (${room.capacity.adults * roomCount} adults + ${room.capacity.children * roomCount} children). You selected ${totalGuests} guests.`,
      });
    }

    if (totalAdults < 1) {
      return res.status(400).json({
        success: false,
        message: "At least one adult is required for booking",
      });
    }

    if (totalAdults > (room.capacity.adults * roomCount)) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${room.capacity.adults * roomCount} adults allowed for ${roomCount} room(s)`,
      });
    }

    if (totalChildren > (room.capacity.children * roomCount)) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${room.capacity.children * roomCount} children allowed for ${roomCount} room(s)`,
      });
    }

    // Prepare raw Date objects (no time normalization) for pricing
    const rawCheckIn = new Date(checkInDate);
    const rawCheckOut = new Date(checkOutDate);

    // Availability normalization (0:00 start, 23:59 end) used for overlap checks
    const availCheckIn = new Date(rawCheckIn);
    availCheckIn.setHours(0, 0, 0, 0);
    const availCheckOut = new Date(rawCheckOut);
    availCheckOut.setHours(23, 59, 59, 999);

    // Allocation normalization (store as midnight boundaries)
    const allocCheckIn = new Date(rawCheckIn);
    allocCheckIn.setHours(0, 0, 0, 0);
    const allocCheckOut = new Date(rawCheckOut);
    allocCheckOut.setHours(0, 0, 0, 0);

    // General checkIn/checkOut used for availability checks and booking storage
    const checkIn = new Date(rawCheckIn);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(rawCheckOut);
    checkOut.setHours(23, 59, 59, 999);

    const isAvailable = await room.isAvailableForDates(availCheckIn, availCheckOut, roomCount);
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: "Room not available for selected nights"
      });
    }

    // Calculate pricing using raw dates so that nights = checkOut - checkIn correctly
    const roomPrice = room.getPriceForDates(rawCheckIn, rawCheckOut);
    const nights = Math.ceil((rawCheckOut - rawCheckIn) / (1000 * 60 * 60 * 24));

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

    // Handle redemption code application
    let appliedRedemption = null;
    let redemptionDiscountAmount = 0;

    /* 
    if (redemptionCode) {
      try {
        // Find and validate redemption
        const redemption = await RewardRedemption.findOne({
          redemptionCode: redemptionCode.toUpperCase(),
          user: req.user.id
        });

        if (!redemption) {
          return res.status(400).json({
            success: false,
            message: "Invalid redemption code",
          });
        }

        if (!redemption.isValidForUse()) {
          return res.status(400).json({
            success: false,
            message: redemption.status === 'Used' ? 'Redemption code has already been used' :
              redemption.status === 'Expired' ? 'Redemption code has expired' :
                'Redemption code is not valid',
          });
        }

        // Calculate redemption discount
        const reward = redemption.reward;
        const subtotalAfterDiscount = subtotal - discountAmount; // Apply after regular discount

        if (reward.discountType === 'percentage') {
          redemptionDiscountAmount = (subtotalAfterDiscount * reward.discountValue) / 100;
          if (reward.maxDiscount && redemptionDiscountAmount > reward.maxDiscount) {
            redemptionDiscountAmount = reward.maxDiscount;
          }
        } else if (reward.discountType === 'fixed') {
          redemptionDiscountAmount = Math.min(reward.discountValue, subtotalAfterDiscount);
        }

        if (redemptionDiscountAmount > 0) {
          appliedRedemption = {
            redemptionId: redemption.redemptionId,
            code: redemption.redemptionCode,
            rewardName: reward.name,
            discountType: reward.discountType,
            discountValue: reward.discountValue,
            amount: redemptionDiscountAmount
          };
        }
      } catch (redemptionError) {
        console.error('Redemption validation error:', redemptionError);
        return res.status(400).json({
          success: false,
          message: "Error applying redemption code",
        });
      }
    }
    */

    // Check for room availability (CAPACITY CHECK)
    const selectedRoomNumbers = req.body.roomNumbers || []; // Array of room number strings

    const availableRoomCount = await RoomNumber.getAvailableCount(roomId, checkIn, checkOut);

    if (availableRoomCount < roomCount) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableRoomCount} rooms available for the selected dates. You requested ${roomCount} rooms.`,
      });
    }

    // Verify specific room numbers if provided
    let roomNumberDocs = [];
    if (selectedRoomNumbers.length > 0) {
      if (selectedRoomNumbers.length !== roomCount) {
        return res.status(400).json({
          success: false,
          message: `Number of selected room numbers (${selectedRoomNumbers.length}) does not match room count (${roomCount}).`,
        });
      }

      for (const num of selectedRoomNumbers) {
        const rn = await RoomNumber.findOne({ roomNumber: num, roomType: roomId, isActive: true });
        if (!rn) {
          return res.status(400).json({ success: false, message: `Room number ${num} not found or inactive.` });
        }
        if (!(await rn.isAvailableForDates(checkIn, checkOut))) {
          return res.status(400).json({ success: false, message: `Room number ${num} is not available for selected dates.` });
        }
        roomNumberDocs.push(rn);
      }
    } else {
      // Auto-allocate room numbers if not provided
      const allAvailable = await RoomNumber.find({ roomType: roomId, isActive: true });
      for (const rn of allAvailable) {
        if (!roomNumberDocs.map(d => d._id.toString()).includes(rn._id.toString())) {
          if (await rn.isAvailableForDates(checkIn, checkOut)) {
            roomNumberDocs.push(rn);
            if (roomNumberDocs.length === roomCount) break;
          }
        }
      }

      if (roomNumberDocs.length < roomCount) {
        return res.status(400).json({ success: false, message: "Could not find enough available room numbers." });
      }
    }

    // Calculate total room price (sum for all rooms)
    const perRoomPrice = room.getPriceForDates(rawCheckIn, rawCheckOut);
    const totalRoomPrice = perRoomPrice * roomCount;

    // Calculate final amounts
    const totalDiscountAmount = discountAmount + redemptionDiscountAmount;
    const subtotalAfterDiscounts = (totalRoomPrice + (extraServices?.reduce((sum, s) => sum + (s.price * s.quantity), 0) || 0)) - totalDiscountAmount;

    // Fetch dynamic GST settings
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne({ type: 'tax' });
    const gstRate = settings ? settings.gstPercentage : 18;

    const gst = subtotalAfterDiscounts * (gstRate / 100);
    const totalAmount = subtotalAfterDiscounts + gst;

    // Ensure total amount is not negative
    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount after discounts",
      });
    }

    // Prepare rooms array for the new Booking model structure
    const bookingRooms = roomNumberDocs.map(rn => ({
      roomType: roomId,
      roomNumber: rn._id,
      roomNumberInfo: {
        number: rn.roomNumber,
        floor: rn.floor
      },
      price: perRoomPrice
    }));

    // Create booking with multiple rooms
    const booking = await Booking.create({
      user: req.user.id,
      rooms: bookingRooms,
      guestDetails,
      bookingDates: {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
      },
      pricing: {
        roomPrice: totalRoomPrice,
        extraServices: extraServices || [],
        subtotal: totalRoomPrice + (extraServices?.reduce((sum, s) => sum + (s.price * s.quantity), 0) || 0),
        discount: appliedDiscount ? {
          couponCode: appliedDiscount.code,
          amount: discountAmount,
          percentage: appliedDiscount.type === 'percentage' ? appliedDiscount.value : 0
        } : {
          couponCode: null,
          amount: 0,
          percentage: 0
        },
        redemption: appliedRedemption ? {
          redemptionCode: appliedRedemption.code,
          rewardName: appliedRedemption.rewardName,
          amount: redemptionDiscountAmount,
          discountType: appliedRedemption.discountType
        } : null,
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

    // ALLOCATE ROOM NUMBERS
    const RoomAllocation = require('../models/RoomAllocation');
    const now = new Date();
    const isActiveNow = (allocCheckIn <= now && allocCheckOut > now);

    for (const rn of roomNumberDocs) {
      try {
        await RoomAllocation.create({
          booking: booking._id,
          roomNumber: rn._id,
          roomType: roomId,
          guestName: guestDetails.primaryGuest.name,
          checkInDate: allocCheckIn,
          checkOutDate: allocCheckOut,
          status: 'Active'
        });

        if (isActiveNow) {
          await rn.allocate(
            booking._id,
            req.user.id,
            guestDetails.primaryGuest.name,
            allocCheckIn,
            allocCheckOut
          );
        }
        console.log(`Room number ${rn.roomNumber} assigned to booking ${booking.bookingId}`);
      } catch (allocationError) {
        console.error(`Error allocating room number ${rn.roomNumber}:`, allocationError);
      }
    }

    // If redemption was applied, mark it as used

    /* 
    if (appliedRedemption) {
      try {
        const redemption = await RewardRedemption.findOne({
          redemptionCode: appliedRedemption.code,
          user: req.user.id
        });
        if (redemption) {
          await redemption.markAsUsed({
            usedFor: `Booking ${booking.bookingId} `,
            usedAmount: redemptionDiscountAmount,
            usedBy: req.user.id
          });
          console.log(`Redemption ${appliedRedemption.code} marked as used for booking ${booking.bookingId}`);
        }
      } catch (redemptionUpdateError) {
        console.error('Error updating redemption usage:', redemptionUpdateError);
        // Continue with booking creation even if redemption update fails
      }
    }
    */
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

      // Check if this is a Razorpay payment (netbanking, wallet, card, upi, emi, etc.)
      const razorpayMethods = ['netbanking', 'wallet', 'card', 'upi', 'emi', 'cardless_emi', 'paylater'];
      const isRazorpayPayment = razorpayMethods.includes(normalizedPaymentMethod.toLowerCase());

      // Build payment details object based on payment method
      const paymentDetailsObj = {};

      if (normalizedPaymentMethod === "Card" || normalizedPaymentMethod === "card") {
        // Store card payment details
        paymentDetailsObj.cardLast4 = paymentDetails.cardLast4 || null;
        paymentDetailsObj.cardBrand = paymentDetails.cardBrand || null;
        paymentDetailsObj.cardHolderName = paymentDetails.cardHolderName || null;
      } else if (normalizedPaymentMethod === "UPI" || normalizedPaymentMethod === "upi") {
        // Store UPI payment details
        paymentDetailsObj.upiId = paymentDetails.upiId || null;
      } else if (normalizedPaymentMethod === "Online" || normalizedPaymentMethod === "netbanking") {
        // Store online banking details
        paymentDetailsObj.bankName = paymentDetails.bankName || null;
      } else if (normalizedPaymentMethod === "wallet") {
        // Store wallet details
        paymentDetailsObj.walletProvider = paymentDetails.walletProvider || 'Unknown';
      }

      // Add email and contact for Razorpay payments
      if (isRazorpayPayment) {
        paymentDetailsObj.email = paymentDetails.email || guestDetails.primaryGuest.email;
        paymentDetailsObj.contact = paymentDetails.contact || guestDetails.primaryGuest.phone;
      }

      const paymentData = {
        booking: booking._id,
        user: req.user.id,
        amount: totalAmount,
        currency: 'INR',
        paymentMethod: normalizedPaymentMethod, // This will be: netbanking, card, upi, wallet, etc.
        method: normalizedPaymentMethod, // Alias field
        gateway: isRazorpayPayment ? "Razorpay" : (isCashPayment ? "Manual" : "Manual"),
        paymentGateway: isRazorpayPayment ? "Razorpay" : (isCashPayment ? "Manual" : "Manual"),
        status: "Completed", // All payments are completed immediately
        transactionId: paymentDetails?.transactionId || (isCashPayment ? `CASH_${booking._id} ` : `TXN${Date.now()} `),
        gatewayTransactionId: paymentDetails?.transactionId || (isCashPayment ? `CASH_${booking._id} ` : `TXN${Date.now()} `),
        gatewayOrderId: paymentDetails?.orderId || null, // Razorpay order ID
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
          discountAmount: discountAmount || 0,
          razorpayPayment: isRazorpayPayment,
          paymentMethodType: normalizedPaymentMethod
        }
      };

      payment = await Payment.create(paymentData);
      console.log('Payment record created successfully:', payment.paymentId);
      console.log('Payment method stored:', normalizedPaymentMethod);
      console.log('Gateway:', isRazorpayPayment ? 'Razorpay' : 'Manual');

      // Update booking with payment reference
      // Payment is completed but booking status remains Pending until admin confirms
      booking.paymentStatus = "Paid";
      booking.status = "Pending"; // Changed from "Confirmed" to "Pending"
      booking.paymentDetails.paymentId = payment._id;
      await booking.save();

      // Payment notification disabled
      // try {
      //   await createPaymentNotification(
      //     req.user.id,
      //     {
      //       payment,
      //       booking,
      //       amount: totalAmount,
      //       method: normalizedPaymentMethod,
      //       room
      //     },
      //     'payment_completed'
      //   );
      // } catch (notifError) {
      //   console.error("Payment notification error:", notifError);
      // }
    } catch (paymentError) {
      console.error("Payment creation error:", paymentError);
      console.error("Payment error details:", paymentError.message);
      // Continue even if payment creation fails
    }

    // Populate booking details
    await booking.populate([
      { path: "user", select: "name email phone" },
      { path: "rooms.roomType", select: "name type" },
    ]);

    // Send confirmation email
    try {
      const htmlMessage = generateBookingReceivedEmail(booking);

      const plainTextMessage = `
Dear ${guestDetails.primaryGuest.name},

Your booking has been received and is PENDING CONFIRMATION!

BOOKING DETAILS:
- Booking ID: ${booking.bookingId}
- Status: PENDING(Awaiting Admin Confirmation)
  - Rooms: ${booking.rooms.map(r => `${r.roomNumberInfo.number} (${r.roomType.name})`).join(', ')}
- Check -in Date: ${checkIn.toDateString()}
- Check - out Date: ${checkOut.toDateString()}
- Number of Nights: ${nights}
- Total Guests: ${guestDetails.totalAdults} Adult(s), ${guestDetails.totalChildren} Child(ren)

CONTACT INFORMATION:
- Name: ${guestDetails.primaryGuest.name}
- Email: ${guestDetails.primaryGuest.email}
- Phone: ${guestDetails.primaryGuest.phone}
${guestDetails.additionalGuests && guestDetails.additionalGuests.length > 0 ? `\nAdditional Guests:\n${guestDetails.additionalGuests.map(g => `- ${g.name}`).join('\n')}` : ''}

PRICING BREAKDOWN:
- Room Rate(${nights} nights): ₹${roomPrice.toFixed(2)}${extraServices && extraServices.length > 0 ? `\nExtra Services:\n${extraServices.map(service => `- ${service.name} × ${service.quantity} = ₹${(service.price * service.quantity).toFixed(2)}`).join('\n')}` : ''}
- Subtotal: ₹${subtotal.toFixed(2)}
- GST(18 %): ₹${gst.toFixed(2)}
- TOTAL AMOUNT: ₹${totalAmount.toFixed(2)}

PAYMENT INFORMATION:
- Payment Method: ${paymentDetails?.method || 'Cash'}
- Payment Status: ${booking.paymentStatus}
${specialRequests ? `\nSPECIAL REQUESTS:\n${specialRequests}` : ''}

IMPORTANT: Your booking is currently PENDING and will be confirmed by our admin team shortly.You will receive a confirmation email once your booking is approved.

If you need to cancel or modify your booking, please contact us at concierge @luxuryhotel.com or call + 1(555) 123 - 4567.

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
        roomName: booking.rooms.length > 1 ? `${booking.rooms.length} Rooms` : booking.rooms[0].roomType.name,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      });



      // Create notification in database for USER
      await createRoomBookingNotification(
        req.user.id,
        { booking, rooms: booking.rooms, status: booking.status },
        'created'
      );

      // NOTIFY ADMINS: Find all admins and send notifications
      const admins = await User.find({ role: 'admin' });
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          try {
            await createRoomBookingNotification(
              admin._id,
              { booking, rooms: booking.rooms, status: booking.status },
              'created_admin'
            );



          } catch (adminNotifError) {
            console.error(`Failed to notify admin ${admin._id}:`, adminNotifError);
          }
        }
        console.log(`Notified ${admins.length} admins about new booking ${booking.bookingId}`);
      }
    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
    }

    res.status(201).json({
      success: true,
      data: booking,
      bookingId: booking.bookingId,
      paymentId: payment?.paymentId || null,
      message: "Booking created successfully and is pending admin confirmation",

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
    booking.status = 'PartiallyCancelled';

    await booking.save();

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
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

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
    if (status === 'Confirmed' || status === 'CheckedIn') {
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

          if (isActiveNow) {
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
};
