const RoomNumber = require('../models/RoomNumber');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const RoomAllocation = require('../models/RoomAllocation');

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

        // DATE-WISE FILTERING LOGIC
        if (checkInDate && checkOutDate) {
            const searchCheckIn = new Date(checkInDate);
            searchCheckIn.setHours(23, 59, 59, 999); // Treat check-in as end of day to allow same-day turnover

            const searchCheckOut = new Date(checkOutDate);
            searchCheckOut.setHours(0, 0, 0, 0); // Treated as morning checkout

            // Fetch conflicting Allocations from RoomAllocation collection
            // This is the source of truth for "Allocated" status
            const conflictingAllocations = await RoomAllocation.find({
                roomNumber: { $in: roomNumbers.map(r => r._id) },
                status: 'Active',
                checkInDate: { $lt: searchCheckOut },
                checkOutDate: { $gt: searchCheckIn }
            }).populate('booking');

            // Create a map for quick lookup
            const allocationMap = {};
            conflictingAllocations.forEach(allocation => {
                const roomId = allocation.roomNumber.toString();
                // If multiple allocations overlap (shouldn't happen), pick the first one
                if (!allocationMap[roomId]) {
                    allocationMap[roomId] = allocation;
                }
            });

            // Filter rooms based on date overlap
            roomNumbers = roomNumbers.map(room => {
                const roomObj = room.toObject();
                const conflictingAllocation = allocationMap[room._id.toString()];

                // Check maintenance schedule for date overlap
                let maintenanceStatus = null;
                if (roomObj.maintenanceSchedule && roomObj.maintenanceSchedule.length > 0) {
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
                    roomObj.dateWiseStatus = 'Allocated';

                    // Check if actually occupied (checked in)
                    if (conflictingAllocation.booking && conflictingAllocation.booking.status === 'CheckedIn') {
                        roomObj.dateWiseStatus = 'Occupied';
                    }

                    roomObj.showCustomerDetails = true;
                    // Mock currentAllocation for display
                    roomObj.currentAllocation = {
                        booking: conflictingAllocation.booking,
                        customer: conflictingAllocation.booking?.user, // We might need to populate user in query if needed, but 'booking' has 'user' which is ID usually. 
                        // Ideally we populate booking.user in the find above.
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
        } else {
            // No date filtering - show current status as-is
            if (status) {
                roomNumbers = roomNumbers.filter(room => room.status === status);
            }
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
            dateFiltering: checkInDate && checkOutDate ? {
                checkInDate,
                checkOutDate,
                message: 'Rooms filtered by date overlap. Checkout date is treated as free.'
            } : null
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

        // Check availability against RoomAllocations (Source of Truth)
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        // Find conflicting allocations
        const conflictingAllocation = await RoomAllocation.findOne({
            roomNumber: roomNumber._id,
            status: 'Active',
            booking: { $ne: bookingId }, // Exclude current booking if we are updating it (re-allocation)
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn }
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
        // First check if there is arguably an existing allocation for this booking to update
        let existingAllocation = null;
        if (bookingId) {
            existingAllocation = await RoomAllocation.findOne({ booking: bookingId });
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
            await Booking.findByIdAndUpdate(bookingId, {
                roomNumber: roomNumber._id,
                status: 'Confirmed', // Ensure status is confirmed
                roomNumberInfo: {
                    number: roomNumber.roomNumber,
                    floor: roomNumber.floor,
                    allocatedAt: new Date()
                }
            });
        }

        // Determine if we should update the RoomNumber's status (Is this allocation ACTIVE NOW?)
        // If checkIn <= Today AND checkOut > Today
        const today = new Date();
        const todayStart = new Date(today.setHours(0, 0, 0, 0));

        const isActiveNow = (checkIn <= new Date() && checkOut > todayStart);

        if (isActiveNow) {
            // It's a current allocation, update the room status
            await roomNumber.allocate(bookingId, customerId, customerName, checkIn, checkOut);
        }

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
// @access  Public
const getAvailableRoomNumbers = async (req, res) => {
    try {
        const { roomTypeId, checkInDate, checkOutDate } = req.query;

        if (!roomTypeId || !checkInDate || !checkOutDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide roomTypeId, checkInDate, and checkOutDate'
            });
        }

        const availableCount = await RoomNumber.getAvailableCount(
            roomTypeId,
            new Date(checkInDate),
            new Date(checkOutDate)
        );

        res.status(200).json({
            success: true,
            data: {
                roomTypeId,
                checkInDate,
                checkOutDate,
                availableCount
            }
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
