const Room = require('../models/Room');
const Booking = require('../models/Booking');

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
const getRooms = async (req, res) => {
    try {
        const {
            type,
            minPrice,
            maxPrice,
            adults,
            children,
            checkIn,
            checkOut,
            features,
            sort,
            page = 1,
            limit = 10
        } = req.query;

        let query = { isActive: true };

        // Filter by type
        if (type) {
            query.type = type;
        }

        // Filter by price range
        if (minPrice || maxPrice) {
            query['price.basePrice'] = {};
            if (minPrice) query['price.basePrice'].$gte = Number(minPrice);
            if (maxPrice) query['price.basePrice'].$lte = Number(maxPrice);
        }

        // Filter by capacity
        if (adults) {
            query['capacity.adults'] = { $gte: Number(adults) };
        }
        if (children) {
            query['capacity.children'] = { $gte: Number(children) };
        }

        // Filter by features
        if (features) {
            const featureArray = features.split(',');
            featureArray.forEach(feature => {
                query[`features.${feature}`] = true;
            });
        }

        // Check availability for specific dates
        if (checkIn && checkOut) {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);

            // Find rooms that are not booked for these dates
            const bookedRooms = await Booking.find({
                status: { $in: ['Confirmed', 'CheckedIn'] },
                $or: [
                    {
                        'bookingDates.checkInDate': { $lte: checkOutDate },
                        'bookingDates.checkOutDate': { $gt: checkInDate }
                    }
                ]
            }).distinct('room');

            query._id = { $nin: bookedRooms };
        }

        // Sorting
        let sortOptions = {};
        if (sort) {
            const sortBy = sort.split(',').join(' ');
            sortOptions = { [sortBy.split(' ')[0]]: sortBy.includes('-') ? -1 : 1 };
        } else {
            sortOptions = { 'price.basePrice': 1 };
        }

        // Pagination
        const skip = (page - 1) * limit;

        const rooms = await Room.find(query)
            .sort(sortOptions)
            .limit(Number(limit))
            .skip(skip);

        const total = await Room.countDocuments(query);

        res.status(200).json({
            success: true,
            count: rooms.length,
            total,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            },
            data: rooms
        });

    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Public
const getRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });

    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Check room availability
// @route   POST /api/rooms/:id/availability
// @access  Public
const checkAvailability = async (req, res) => {
    try {
        const { checkIn, checkOut } = req.body;
        const room = await Room.findById(req.params.id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        const isAvailable = await room.isAvailableForDates(checkInDate, checkOutDate);
        const price = room.getPriceForDates(checkInDate, checkOutDate);

        res.status(200).json({
            success: true,
            data: {
                available: isAvailable,
                totalPrice: price,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                nights: Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
            }
        });

    } catch (error) {
        console.error('Check availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Create room (Admin only)
// @route   POST /api/rooms
// @access  Private/Admin
const createRoom = async (req, res) => {
    try {
        const body = { ...req.body };

        // Parse JSON-encoded nested fields when coming from multipart/form-data
        const parseIfJson = (value) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value;
                }
            }
            return value;
        };

        body.capacity = parseIfJson(body.capacity);
        body.price = parseIfJson(body.price);
        body.features = parseIfJson(body.features);

        // Map uploaded files (if any) to images array
        if (req.files && req.files.length > 0) {
            body.images = req.files.map((file, index) => ({
                url: `/uploads/rooms/${file.filename}`,
                altText: `${body.name || 'Room'} - Image ${index + 1}`,
                isPrimary: index === 0
            }));
        }

        // If no images were uploaded, ensure there is at least one placeholder image
        if (!body.images || body.images.length === 0) {
            body.images = [{
                url: 'https://via.placeholder.com/400x250?text=Room+Image',
                altText: `${body.name || 'Room'} - Image`,
                isPrimary: true
            }];
        }

        const room = await Room.create(body);

        res.status(201).json({
            success: true,
            data: room
        });

    } catch (error) {
        console.error('Create room error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Room number already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Update room (Admin only)
// @route   PUT /api/rooms/:id
// @access  Private/Admin
const updateRoom = async (req, res) => {
    try {
        const room = await Room.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });

    } catch (error) {
        console.error('Update room error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete room (Admin only)
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
const deleteRoom = async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if room has any active bookings
        const activeBookings = await Booking.countDocuments({
            room: req.params.id,
            status: { $in: ['Confirmed', 'CheckedIn'] }
        });

        if (activeBookings > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete room with active bookings'
            });
        }

        await room.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Room deleted successfully'
        });

    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get room types
// @route   GET /api/rooms/types
// @access  Public
const getRoomTypes = async (req, res) => {
    try {
        const types = await Room.distinct('type', { isActive: true });
        
        res.status(200).json({
            success: true,
            data: types
        });

    } catch (error) {
        console.error('Get room types error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

module.exports = {
    getRooms,
    getRoom,
    checkAvailability,
    createRoom,
    updateRoom,
    deleteRoom,
    getRoomTypes
};