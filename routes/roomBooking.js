const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');

// Lock a room for booking
router.post('/lock/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { lockDurationMinutes = 5 } = req.body;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (room.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: 'Room is not available for booking'
      });
    }

    // Lock the room
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);
    
    room.status = 'locked';
    room.lockedBy = req.user.id;
    room.lockExpiry = lockExpiry;
    
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Room locked successfully',
      data: {
        roomId: room._id,
        lockedBy: req.user.id,
        lockExpiry
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Unlock a room
router.post('/unlock/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is the one who locked the room or is admin
    if (room.lockedBy && room.lockedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unlock this room'
      });
    }

    // Unlock the room
    room.status = 'Available';
    room.lockedBy = null;
    room.lockExpiry = null;
    
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Room unlocked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Confirm booking for a locked room
router.post('/confirm/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { bookingData } = req.body;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (room.status !== 'locked' || room.lockedBy.toString() !== req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Room is not locked by this user'
      });
    }

    // Create booking
    const booking = await Booking.create({
      ...bookingData,
      room: roomId,
      user: req.user.id,
      status: 'Confirmed'
    });

    // Update room status
    room.status = 'booked';
    room.lockedBy = null;
    room.lockExpiry = null;
    await room.save();

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Release expired locks (admin only)
router.post('/release-expired-locks', protect, authorize('admin'), async (req, res) => {
  try {
    const now = new Date();
    const result = await Room.updateMany(
      {
        status: 'locked',
        lockExpiry: { $lt: now }
      },
      {
        $set: {
          status: 'Available',
          lockedBy: null,
          lockExpiry: null
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Released ${result.modifiedCount} expired locks`,
      data: {
        releasedCount: result.modifiedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
