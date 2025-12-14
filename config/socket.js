const socketIo = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected to socket:', socket.id);

    // Join admin room for dashboard updates
    socket.on('join-admin-room', () => {
      socket.join('admin-dashboard');
      console.log('Admin joined dashboard room:', socket.id);
    });

    // Join user-specific room for personal updates
    socket.on('join-user-room', (userId) => {
      socket.join(`user-${userId}`);
      console.log('User joined personal room:', userId, socket.id);
    });

    // Join rooms page for real-time room updates
    socket.on('join_rooms_page', () => {
      socket.join('rooms-page');
      console.log('User joined rooms page:', socket.id);
    });

    // Handle room locking
    socket.on('lock_room', async (data) => {
      try {
        const { roomId, userId } = data;
        console.log(`Room lock attempt: Room ${roomId} by User ${userId}`);
        
        // Broadcast to all clients on rooms page
        socket.to('rooms-page').emit('room_locked', {
          roomId,
          lockedBy: userId,
          timestamp: new Date()
        });
        
        // Also emit general room update
        io.to('rooms-page').emit('room_updated', {
          roomId,
          status: 'locked',
          lockedBy: userId
        });
        
      } catch (error) {
        console.error('Error handling room lock:', error);
        socket.emit('booking_failed', { 
          message: 'Failed to lock room',
          error: error.message 
        });
      }
    });

    // Handle booking confirmation
    socket.on('confirm_booking', async (data) => {
      try {
        const { roomId, userId, bookingId } = data;
        console.log(`Booking confirmed: Room ${roomId}, Booking ${bookingId}`);
        
        // Broadcast to all clients
        io.to('rooms-page').emit('room_updated', {
          roomId,
          status: 'booked',
          bookingId
        });
        
        // Notify admin dashboard
        io.to('admin-dashboard').emit('new_booking_confirmed', {
          roomId,
          userId,
          bookingId,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('Error confirming booking:', error);
        socket.emit('booking_failed', { 
          message: 'Failed to confirm booking',
          error: error.message 
        });
      }
    });

    // Handle booking cancellation
    socket.on('cancel_booking', async (data) => {
      try {
        const { roomId, userId, bookingId } = data;
        console.log(`Booking cancelled: Room ${roomId}, Booking ${bookingId}`);
        
        // Broadcast to all clients
        io.to('rooms-page').emit('room_updated', {
          roomId,
          status: 'available',
          bookingId: null
        });
        
        // Notify admin dashboard
        io.to('admin-dashboard').emit('booking_cancelled', {
          roomId,
          userId,
          bookingId,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('Error cancelling booking:', error);
        socket.emit('booking_failed', { 
          message: 'Failed to cancel booking',
          error: error.message 
        });
      }
    });

    // Handle booking updates
    socket.on('booking-update', (data) => {
      socket.to('admin-dashboard').emit('booking-update', data);
    });

    // Handle order updates
    socket.on('order-update', (data) => {
      socket.to('admin-dashboard').emit('order-update', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const getSocketIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Emit dashboard update event
const emitDashboardUpdate = (data) => {
  try {
    const socketIo = getSocketIo();
    socketIo.to('admin-dashboard').emit('dashboard-update', data);
    console.log('Dashboard update emitted:', data);
  } catch (error) {
    console.error('Error emitting dashboard update:', error);
  }
};

// Emit new booking notification
const emitNewBooking = (bookingData) => {
  try {
    const socketIo = getSocketIo();
    socketIo.to('admin-dashboard').emit('new-booking', bookingData);
    console.log('New booking emitted:', bookingData.bookingId);
  } catch (error) {
    console.error('Error emitting new booking:', error);
  }
};

// Emit new order notification
const emitNewOrder = (orderData) => {
  try {
    const socketIo = getSocketIo();
    socketIo.to('admin-dashboard').emit('new-order', orderData);
    console.log('New order emitted:', orderData.orderNumber);
  } catch (error) {
    console.error('Error emitting new order:', error);
  }
};

// Emit booking status change
const emitBookingStatusChange = (bookingId, status, userId) => {
  try {
    const socketIo = getSocketIo();
    const data = { bookingId, status, timestamp: new Date() };
    
    // Notify admin dashboard
    socketIo.to('admin-dashboard').emit('booking-status-change', data);
    
    // Notify specific user
    if (userId) {
      socketIo.to(`user-${userId}`).emit('booking-status-change', data);
    }
    
    console.log('Booking status change emitted:', data);
  } catch (error) {
    console.error('Error emitting booking status change:', error);
  }
};

// Emit order status change
const emitOrderStatusChange = (orderNumber, status, userId) => {
  try {
    const socketIo = getSocketIo();
    const data = { orderNumber, status, timestamp: new Date() };
    
    // Notify admin dashboard
    socketIo.to('admin-dashboard').emit('order-status-change', data);
    
    // Notify specific user
    if (userId) {
      socketIo.to(`user-${userId}`).emit('order-status-change', data);
    }
    
    console.log('Order status change emitted:', data);
  } catch (error) {
    console.error('Error emitting order status change:', error);
  }
};

// Emit user notification
const emitUserNotification = (userId, notification) => {
  try {
    const socketIo = getSocketIo();
    socketIo.to(`user-${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date()
    });
    console.log('User notification emitted:', userId, notification.title);
  } catch (error) {
    console.error('Error emitting user notification:', error);
  }
};

// Emit room lock notification
const emitRoomLocked = (roomId, userId) => {
  try {
    const socketIo = getSocketIo();
    const data = { roomId, lockedBy: userId, timestamp: new Date() };
    
    socketIo.to('rooms-page').emit('room_locked', data);
    socketIo.to('rooms-page').emit('room_updated', {
      roomId,
      status: 'locked',
      lockedBy: userId
    });
    
    console.log('Room lock emitted:', data);
  } catch (error) {
    console.error('Error emitting room lock:', error);
  }
};

// Emit room unlock notification
const emitRoomUnlocked = (roomId) => {
  try {
    const socketIo = getSocketIo();
    const data = { roomId, status: 'available', timestamp: new Date() };
    
    socketIo.to('rooms-page').emit('room_updated', data);
    
    console.log('Room unlock emitted:', data);
  } catch (error) {
    console.error('Error emitting room unlock:', error);
  }
};

// Emit booking confirmed notification
const emitBookingConfirmed = (roomId, bookingId, userId) => {
  try {
    const socketIo = getSocketIo();
    const data = { roomId, status: 'booked', bookingId, timestamp: new Date() };
    
    socketIo.to('rooms-page').emit('room_updated', data);
    socketIo.to('admin-dashboard').emit('new_booking_confirmed', {
      roomId,
      userId,
      bookingId,
      timestamp: new Date()
    });
    
    console.log('Booking confirmed emitted:', data);
  } catch (error) {
    console.error('Error emitting booking confirmed:', error);
  }
};

// Emit booking cancelled notification
const emitBookingCancelled = (roomId, bookingId, userId) => {
  try {
    const socketIo = getSocketIo();
    const data = { roomId, status: 'available', bookingId: null, timestamp: new Date() };
    
    socketIo.to('rooms-page').emit('room_updated', data);
    socketIo.to('admin-dashboard').emit('booking_cancelled', {
      roomId,
      userId,
      bookingId,
      timestamp: new Date()
    });
    
    console.log('Booking cancelled emitted:', data);
  } catch (error) {
    console.error('Error emitting booking cancelled:', error);
  }
};

module.exports = {
  initializeSocket,
  getSocketIo,
  emitDashboardUpdate,
  emitNewBooking,
  emitNewOrder,
  emitBookingStatusChange,
  emitOrderStatusChange,
  emitUserNotification,
  emitRoomLocked,
  emitRoomUnlocked,
  emitBookingConfirmed,
  emitBookingCancelled
};
