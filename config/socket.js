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

module.exports = {
  initializeSocket,
  getSocketIo,
  emitDashboardUpdate,
  emitNewBooking,
  emitNewOrder,
  emitBookingStatusChange,
  emitOrderStatusChange,
  emitUserNotification
};
