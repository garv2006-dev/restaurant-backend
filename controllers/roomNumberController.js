const RoomNumber = require('../models/RoomNumber');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const RoomAllocation = require('../models/RoomAllocation');
const { emitRoomNumbersChange } = require('../config/socket');

// @desc    Create room numbers in bulk
// @route   POST /api/room-numbers/bulk-create
// @access  Private/Admin
const createRoomNumbers = async (req, res) => {
    try {
        const { roomTypeId, startNumber, endNumber, floor, prefix = '' } = req.body;

        // Validate input
        if (!roomTypeId || !startNumber || !endNumber || !floor) {
            return res.status(400).json({
                success: false,
                message: 'Please provide roomTypeId, startNumber, endNumber, and floor'
            });
        }

        // Check if room type exists
        const roomType = await Room.findById(roomTypeId);
        if (!roomType) {
            return res.status(404).json({
                success: false,
                message: 'Room type not found'
            });
        }

        const start = parseInt(startNumber);
        const end = parseInt(endNumber);

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'Start number must be less than or equal to end number'
            });
        }

        const roomNumbers = [];
        const errors = [];

        for (let i = start; i <= end; i++) {
            const roomNumber = `${prefix}${i}`;

            // Check if room number already exists for this room type
            const existing = await RoomNumber.findOne({ roomNumber, roomType: roomTypeId });
            if (existing) {
                errors.push(`Room number ${roomNumber} already exists`);
                continue;
            }

            const newRoomNumber = await RoomNumber.create({
                roomNumber,
                roomType: roomTypeId,
                floor,
                status: 'Available'
            });

            roomNumbers.push(newRoomNumber);
        }

        // Emit socket notification
        if (roomNumbers.length > 0) {
            emitRoomNumbersChange();
        }

        res.status(201).json({
            success: true,
            count: roomNumbers.length,
            data: roomNumbers,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Create room numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get all room numbers with filters
// @route   GET /api/room-numbers
// @access  Private/Admin
// @desc    Get all room numbers with filters
// @route   GET /api/room-numbers
// @access  Private/Admin
const getRoomNumbers = async (req, res) => {
    try {
        const {
            roomType,
            status,
            floor,
            roomNumber,
            customerName,
            checkInDate,
            checkOutDate,
            page = 1,
            limit = 50
        } = req.query;

        let query = { isActive: true };

        // Filter by room type
        if (roomType) {
            query.roomType = roomType;
        }

        // Filter by floor
        if (floor) {
            query.floor = parseInt(floor);
        }

        // Search by room number
        if (roomNumber) {
            query.roomNumber = { $regex: roomNumber, $options: 'i' };
        }

        // Search by customer name (only if dates are NOT provided)
        if (customerName && !checkInDate && !checkOutDate) {
            query['currentAllocation.customerName'] = { $regex: customerName, $options: 'i' };
        }

        // Pagination
        const skip = (page - 1) * limit;

        // Fetch all matching rooms
        let roomNumbers = await RoomNumber.find(query)
            .populate('roomType', 'name type description price images')
            .populate('currentAllocation.booking', 'bookingId status')
            .populate('currentAllocation.customer', 'name email phone')
            .sort({ floor: 1, roomNumber: 1 })
            .limit(Number(limit))
            .skip(skip);

        // ALWAYS COMPUTE ALLOCATION-AWARE STATUS
        // Use provided dates or default to "today" to show current allocations
        let searchCheckIn, searchCheckOut;

        if (checkInDate && checkOutDate) {
            // Normalize requested range to cover full days in UTC
            searchCheckIn = new Date(checkInDate);
            searchCheckIn.setUTCHours(0, 0, 0, 0); // start of requested check-in day
            searchCheckOut = new Date(checkOutDate);
            searchCheckOut.setUTCHours(23, 59, 59, 999); // end of requested check-out day
        } else {
            // Default to today's date UTC to show current allocations
            const today = new Date();
            searchCheckIn = new Date(today);
            searchCheckIn.setUTCHours(0, 0, 0, 0);
            searchCheckOut = new Date(today);
            searchCheckOut.setUTCHours(23, 59, 59, 999);
        }

        // Fetch conflicting Allocations from RoomAllocation collection
        // This is the source of truth for "Allocated" status
        const conflictingAllocations = await RoomAllocation.find({
            roomNumber: { $in: roomNumbers.map(r => r._id) },
            status: 'Active',
            checkInDate: { $lte: searchCheckOut },
            checkOutDate: { $gte: searchCheckIn }
        }).populate('booking');

        // Note: We use lte/gte above to catch any overlap with the searched day.
        // For actual turnover logic (checkout day = checkin day), we refine below.

        const refinedAllocations = conflictingAllocations.filter(allocation => {
            // Cross-check: if the booking is Cancelled/CheckedOut/NoShow, 
            // this allocation should NOT be Active — auto-fix it
            if (allocation.booking) {
                const bookingStatus = allocation.booking.status;
                if (['Cancelled', 'CheckedOut', 'NoShow'].includes(bookingStatus)) {
                    // Auto-fix stale allocation (don't await, fire-and-forget)
                    const newAllocStatus = bookingStatus === 'CheckedOut' ? 'Completed' : 'Cancelled';
                    RoomAllocation.findByIdAndUpdate(allocation._id, { status: newAllocStatus })
                        .catch(err => console.error('Auto-fix stale allocation error:', err));
                    return false; // exclude from display
                }
            }

            // Turnover logic: if a room checks out on the EXACT same day/time 
            // that our search starts, and we are NOT looking for "Occupancy" (who is in now),
            // we could treat it as available.

            // Fix: If the allocation's checkout day is exactly or before the search's checkin day, it's not a conflict.
            // Also, if the allocation's checkin day is exactly or after the search's checkout day, it's not a conflict.
            const allocCheckOutDate = new Date(allocation.checkOutDate);
            const allocCheckInDate = new Date(allocation.checkInDate);
            allocCheckOutDate.setUTCHours(0, 0, 0, 0);
            allocCheckInDate.setUTCHours(0, 0, 0, 0);

            const searchIn = new Date(searchCheckIn);
            searchIn.setUTCHours(0, 0, 0, 0);
            const searchOut = new Date(searchCheckOut);
            searchOut.setUTCHours(0, 0, 0, 0);

            if (allocCheckOutDate <= searchIn) {
                return false; // Check out is before or on the day of search check-in
            }
            if (allocCheckInDate >= searchOut) {
                return false; // Check in is after or on the day of search check-out
            }

            return true;
        });

        // Create a map for quick lookup
        const allocationMap = {};
        refinedAllocations.forEach(allocation => {
            const roomId = allocation.roomNumber.toString();
            // If multiple allocations exist for a room (rare but possible in date range),
            // prioritize the one that is currently active or closest to now
            if (!allocationMap[roomId]) {
                allocationMap[roomId] = allocation;
            } else {
                const existing = allocationMap[roomId];
                const now = new Date();
                // If this one is "now", prefer it
                if (allocation.checkInDate <= now && allocation.checkOutDate >= now) {
                    allocationMap[roomId] = allocation;
                }
            }
        });

        // Compute allocation-aware status for all rooms
        roomNumbers = roomNumbers.map(room => {
            const roomObj = room.toObject();
            const conflictingAllocation = allocationMap[room._id.toString()];

            // Priority 1: Check Manual Strict Status
            // If the room is manually set to Maintenance/Out of Service, it overrides everything else
            let maintenanceStatus = null;
            if (roomObj.status === 'Maintenance' || roomObj.status === 'Out of Service') {
                maintenanceStatus = roomObj.status;
            }

            // Priority 2: Check maintenance schedule for date overlap
            if (!maintenanceStatus && roomObj.maintenanceSchedule && roomObj.maintenanceSchedule.length > 0) {
                const isInMaintenance = roomObj.maintenanceSchedule.some(maintenance => {
                    return (
                        searchCheckIn < new Date(maintenance.endDate) &&
                        searchCheckOut > new Date(maintenance.startDate)
                    );
                });
                if (isInMaintenance) {
                    maintenanceStatus = 'Maintenance';
                }
            }

            if (maintenanceStatus) {
                roomObj.dateWiseStatus = maintenanceStatus;
                roomObj.showCustomerDetails = false;
            } else if (conflictingAllocation) {
                // Found an allocation intersection
                // Priority 3: Check actually occupied status (CheckedIn)
                if (conflictingAllocation.booking && conflictingAllocation.booking.status === 'CheckedIn') {
                    roomObj.dateWiseStatus = 'Occupied';
                } else if (conflictingAllocation.status === 'Active') {
                    roomObj.dateWiseStatus = 'Allocated';
                }

                roomObj.showCustomerDetails = true;
                // Mock currentAllocation for display
                roomObj.currentAllocation = {
                    booking: conflictingAllocation.booking,
                    customer: conflictingAllocation.booking?.user,
                    customerName: conflictingAllocation.guestName,
                    checkInDate: conflictingAllocation.checkInDate,
                    checkOutDate: conflictingAllocation.checkOutDate,
                    allocatedAt: conflictingAllocation.createdAt
                };
            } else {
                // No overlap - room is available for searched dates
                roomObj.dateWiseStatus = 'Available';
                roomObj.showCustomerDetails = false;
                // Clear customer details for display
                roomObj.currentAllocation = {
                    booking: null,
                    customer: null,
                    customerName: null,
                    checkInDate: null,
                    checkOutDate: null,
                    allocatedAt: null
                };
            }

            return roomObj;
        });

        // Apply status filter AFTER date-wise calculation
        if (status) {
            roomNumbers = roomNumbers.filter(room => room.dateWiseStatus === status);
        }

        // Apply customer name filter AFTER date-wise calculation
        if (customerName) {
            roomNumbers = roomNumbers.filter(room => {
                return room.showCustomerDetails &&
                    room.currentAllocation?.customerName &&
                    room.currentAllocation.customerName.toLowerCase().includes(customerName.toLowerCase());
            });
        }

        const total = roomNumbers.length;

        res.status(200).json({
            success: true,
            count: roomNumbers.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: roomNumbers,
            dateFiltering: {
                checkInDate: checkInDate || 'today',
                checkOutDate: checkOutDate || 'today',
                message: checkInDate && checkOutDate
                    ? 'Rooms filtered by date overlap. Checkout date is treated as free.'
                    : 'Showing current allocation status based on today\'s date.'
            }
        });

    } catch (error) {
        console.error('Get room numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get single room number
// @route   GET /api/room-numbers/:id
// @access  Private/Admin
const getRoomNumber = async (req, res) => {
    try {
        const roomNumber = await RoomNumber.findById(req.params.id)
            .populate('roomType', 'name type description price images amenities features')
            .populate('currentAllocation.booking', 'bookingId status bookingDates pricing')
            .populate('currentAllocation.customer', 'name email phone')
            .populate('allocationHistory.booking', 'bookingId status')
            .populate('allocationHistory.customer', 'name email');

        if (!roomNumber) {
            return res.status(404).json({
                success: false,
                message: 'Room number not found'
            });
        }

        res.status(200).json({
            success: true,
            data: roomNumber
        });

    } catch (error) {
        console.error('Get room number error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Update room number status
// @route   PUT /api/room-numbers/:id/status
// @access  Private/Admin
const updateRoomNumberStatus = async (req, res) => {
    try {
        const { status, reason, notes } = req.body;

        const roomNumber = await RoomNumber.findById(req.params.id);

        if (!roomNumber) {
            return res.status(404).json({
                success: false,
                message: 'Room number not found'
            });
        }

        // Validate status change
        if (status === 'Maintenance' || status === 'Out of Service') {
            // Check if room has active allocation
            if (roomNumber.currentAllocation && roomNumber.currentAllocation.booking) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot change status. Room has an active allocation.'
                });
            }
        }

        // If manually setting to Available, ensure we clear any stuck allocation
        if (status === 'Available') {
            roomNumber.currentAllocation = {
                booking: null,
                customer: null,
                customerName: null,
                checkInDate: null,
                checkOutDate: null,
                allocatedAt: null
            };
        }

        roomNumber.status = status;

        // If setting to maintenance, add to schedule
        if (status === 'Maintenance' && req.body.maintenanceStart && req.body.maintenanceEnd) {
            roomNumber.maintenanceSchedule.push({
                startDate: new Date(req.body.maintenanceStart),
                endDate: new Date(req.body.maintenanceEnd),
                reason: reason || 'Scheduled maintenance',
                notes: notes || '',
                scheduledBy: req.user._id
            });
        }

        await roomNumber.save();

        // Emit socket notification
        emitRoomNumbersChange();

        res.status(200).json({
            success: true,
            data: roomNumber
        });

    } catch (error) {
        console.error('Update room number status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Allocate room number to booking
// @route   POST /api/room-numbers/:id/allocate
// @access  Private/Admin
const allocateRoomNumber = async (req, res) => {
    try {
        const { bookingId, customerId, customerName, checkInDate, checkOutDate } = req.body;

        const roomNumber = await RoomNumber.findById(req.params.id);

        if (!roomNumber) {
            return res.status(404).json({
                success: false,
                message: 'Room number not found'
            });
        }

        // Strict Status Check
        if (roomNumber.status === 'Maintenance' || roomNumber.status === 'Out of Service') {
            return res.status(400).json({
                success: false,
                message: `Room is currently ${roomNumber.status} and cannot be allocated.`
            });
        }

        // Check availability against RoomAllocations (Source of Truth)
        const checkIn = new Date(checkInDate);
        checkIn.setUTCHours(0, 0, 0, 0);
        const checkOut = new Date(checkOutDate);
        checkOut.setUTCHours(23, 59, 59, 999);

        // Find conflicting allocations
        const conflictingAllocation = await RoomAllocation.findOne({
            roomNumber: roomNumber._id,
            status: 'Active',
            booking: { $ne: bookingId }, // Exclude current booking if we are updating it (re-allocation)
            checkInDate: { $lte: checkOut },
            checkOutDate: { $gte: checkIn }
        }).populate('booking');

        if (conflictingAllocation) {
            return res.status(400).json({
                success: false,
                message: `Room is already allocated to booking ${conflictingAllocation.booking?.bookingId} for dates ${new Date(conflictingAllocation.checkInDate).toLocaleDateString()} - ${new Date(conflictingAllocation.checkOutDate).toLocaleDateString()}`
            });
        }

        // Also check maintenance schedule
        const isInMaintenance = roomNumber.maintenanceSchedule.some(maintenance => {
            return (checkIn < maintenance.endDate && checkOut > maintenance.startDate);
        });

        if (isInMaintenance) {
            return res.status(400).json({
                success: false,
                message: 'Room is scheduled for maintenance during these dates'
            });
        }

        // Create or Update RoomAllocation
        // For multi-room bookings, we look for an allocation for this SPECIFIC room number first, 
        // or any active allocation for this booking that we want to "re-allocate"
        let existingAllocation = null;
        if (bookingId) {
            existingAllocation = await RoomAllocation.findOne({
                booking: bookingId,
                status: 'Active',
                $or: [
                    { roomNumber: roomNumber._id },
                    { roomType: roomNumber.roomType }
                ]
            });
        }

        if (existingAllocation) {
            // Update existing allocation with new room info
            existingAllocation.roomNumber = roomNumber._id;
            existingAllocation.roomType = roomNumber.roomType;
            existingAllocation.checkInDate = checkIn;
            existingAllocation.checkOutDate = checkOut;
            existingAllocation.guestName = customerName;
            existingAllocation.status = 'Active';
            await existingAllocation.save();
        } else {
            // Create new allocation
            await RoomAllocation.create({
                booking: bookingId,
                roomNumber: roomNumber._id,
                roomType: roomNumber.roomType,
                guestName: customerName,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                status: 'Active'
            });
        }

        // Proceed to Update Booking
        if (bookingId) {
            const booking = await Booking.findById(bookingId);
            if (booking) {
                // Find the first room of this type in the booking that hasn't been allocated 
                // OR matches this room number if we're re-allocating
                let roomItem = booking.rooms.find(r =>
                    r.roomType.toString() === roomNumber.roomType.toString() &&
                    (r.roomNumber?.toString() === roomNumber._id.toString() || !r.roomNumber)
                );

                // If none found by type+number, just take the first unallocated of this type
                if (!roomItem) {
                    roomItem = booking.rooms.find(r =>
                        r.roomType.toString() === roomNumber.roomType.toString() && !r.roomNumber
                    );
                }

                if (roomItem) {
                    roomItem.roomNumber = roomNumber._id;
                    roomItem.roomNumberInfo = {
                        number: roomNumber.roomNumber,
                        floor: roomNumber.floor,
                        allocatedAt: new Date()
                    };
                    await booking.save();
                } else {
                    // Legacy support or fallback: update root if field exists (unlikely given current schema)
                    // We'll skip root-level update as it's not in our schema and cause confusion
                }
            }
        }

        // Determine if we should update the RoomNumber's status (Is this allocation ACTIVE NOW?)
        const now = new Date();
        const isActiveNow = (checkIn <= now && checkOut >= now);

        if (isActiveNow) {
            // It's a current allocation, update the room status
            await roomNumber.allocate(bookingId, customerId, customerName, checkIn, checkOut);
        }

        // Emit socket notification
        emitRoomNumbersChange();
        emitBookingStatusChange(); // Also notify bookings list

        res.status(200).json({
            success: true,
            data: roomNumber,
            message: 'Room allocated successfully'
        });

    } catch (error) {
        console.error('Allocate room number error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Deallocate room number (after checkout)
// @route   POST /api/room-numbers/:id/deallocate
// @access  Private/Admin
const deallocateRoomNumber = async (req, res) => {
    try {
        const roomNumber = await RoomNumber.findById(req.params.id);

        if (!roomNumber) {
            return res.status(404).json({
                success: false,
                message: 'Room number not found'
            });
        }

        // Find and complete the active allocation for this room
        // We look for allocations linking to the *current* booking of this room
        if (roomNumber.currentAllocation && roomNumber.currentAllocation.booking) {
            await RoomAllocation.findOneAndUpdate({
                booking: roomNumber.currentAllocation.booking
            }, {
                status: 'Completed'
            });
        }

        await roomNumber.deallocate();

        // Emit socket notification
        emitRoomNumbersChange();

        res.status(200).json({
            success: true,
            data: roomNumber,
            message: 'Room deallocated successfully'
        });

    } catch (error) {
        console.error('Deallocate room number error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get available room numbers for a room type and date range
// @route   GET /api/room-numbers/available
// @route   GET /api/room-numbers/available/:roomTypeId
// @access  Public
const getAvailableRoomNumbers = async (req, res) => {
    try {
        // Accept roomTypeId from path param or query param
        const roomTypeId = req.params.roomTypeId || req.query.roomTypeId;
        const { checkInDate, checkOutDate } = req.query;

        if (!roomTypeId || !checkInDate || !checkOutDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide roomTypeId, checkInDate, and checkOutDate'
            });
        }

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        checkIn.setUTCHours(0, 0, 0, 0);
        checkOut.setUTCHours(23, 59, 59, 999);

        // Find all room numbers for this room type
        const allRoomNumbers = await RoomNumber.find({ roomType: roomTypeId });

        // Filter to get only available rooms
        const availableRoomNumbers = [];
        for (const roomNumber of allRoomNumbers) {
            const isAvailable = await roomNumber.isAvailableForDates(checkIn, checkOut);
            if (isAvailable) {
                availableRoomNumbers.push({
                    id: roomNumber._id,
                    roomNumber: roomNumber.roomNumber,
                    floor: roomNumber.floor,
                    status: roomNumber.status
                });
            }
        }

        res.status(200).json({
            success: true,
            data: availableRoomNumbers
        });

    } catch (error) {
        console.error('Get available room numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Update room number details
// @route   PUT /api/room-numbers/:id
// @access  Private/Admin
const updateRoomNumber = async (req, res) => {
    try {
        const { roomNumber: number, floor, notes } = req.body;

        const roomNumber = await RoomNumber.findById(req.params.id);

        if (!roomNumber) {
            return res.status(404).json({
                success: false,
                message: 'Room number not found'
            });
        }

        // Check if new room number already exists
        if (number && number !== roomNumber.roomNumber) {
            const existing = await RoomNumber.findOne({
                roomNumber: number,
                roomType: roomNumber.roomType,
                _id: { $ne: req.params.id }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'Room number already exists for this room type'
                });
            }

            roomNumber.roomNumber = number;
        }

        if (floor) roomNumber.floor = floor;
        if (notes !== undefined) roomNumber.notes = notes;

        await roomNumber.save();

        // Emit socket notification
        emitRoomNumbersChange();

        res.status(200).json({
            success: true,
            data: roomNumber
        });

    } catch (error) {
        console.error('Update room number error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Delete room number
// @route   DELETE /api/room-numbers/:id
// @access  Private/Admin
const deleteRoomNumber = async (req, res) => {
    try {
        const roomNumber = await RoomNumber.findById(req.params.id);

        if (!roomNumber) {
            return res.status(404).json({
                success: false,
                message: 'Room number not found'
            });
        }

        // Check if room has active allocation
        if (roomNumber.currentAllocation && roomNumber.currentAllocation.booking) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete room number with active allocation'
            });
        }

        // Check if room has any bookings in history
        const hasHistory = roomNumber.allocationHistory && roomNumber.allocationHistory.length > 0;

        if (hasHistory) {
            // Soft delete - mark as inactive
            roomNumber.isActive = false;
            await roomNumber.save();
        } else {
            // Hard delete if no history
            await roomNumber.deleteOne();
        }

        // Emit socket notification
        emitRoomNumbersChange();

        res.status(200).json({
            success: true,
            message: hasHistory ? 'Room number deactivated successfully' : 'Room number deleted successfully'
        });

    } catch (error) {
        console.error('Delete room number error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

module.exports = {
    createRoomNumbers,
    getRoomNumbers,
    getRoomNumber,
    updateRoomNumberStatus,
    allocateRoomNumber,
    deallocateRoomNumber,
    getAvailableRoomNumbers,
    updateRoomNumber,
    deleteRoomNumber
};
