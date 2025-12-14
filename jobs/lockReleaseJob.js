const cron = require('node-cron');
const Room = require('../models/Room');

// Release expired locks
const cleanupExpiredLocks = async () => {
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
    
    console.log(`Released ${result.modifiedCount} expired room locks at ${new Date()}`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error releasing expired locks:', error);
    return 0;
  }
};

// Start the lock release job (runs every 5 minutes)
const startLockReleaseJob = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running expired lock cleanup job...');
    const releasedCount = await cleanupExpiredLocks();
    if (releasedCount > 0) {
      console.log(`Cleanup completed: ${releasedCount} locks released`);
    }
  });
  
  console.log('Lock release job scheduled to run every 5 minutes');
};

module.exports = {
  startLockReleaseJob,
  cleanupExpiredLocks
};
