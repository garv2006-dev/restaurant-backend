const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getLoyaltyProgram,
  getLoyaltyPrograms,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  joinLoyaltyProgram,
  getUserLoyaltyPoints,
  getUsersLoyaltyData,
  redeemLoyaltyPoints,
  addLoyaltyPoints,
  awardPointsForBooking
} = require('../controllers/loyaltyController');

// Public routes
router.get('/program', getLoyaltyProgram);

// Protected routes
router.post('/join', protect, joinLoyaltyProgram);
router.get('/my-points', protect, getUserLoyaltyPoints);
router.post('/redeem', protect, redeemLoyaltyPoints);

// Admin routes
router.get('/programs', protect, authorize('admin'), getLoyaltyPrograms);
router.post('/programs', protect, authorize('admin'), createLoyaltyProgram);
router.put('/programs/:id', protect, authorize('admin'), updateLoyaltyProgram);
router.delete('/programs/:id', protect, authorize('admin'), deleteLoyaltyProgram);
router.get('/users', protect, authorize('admin'), getUsersLoyaltyData);
router.post('/add-points', protect, authorize('admin'), addLoyaltyPoints);

module.exports = router;