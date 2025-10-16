const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getLoyaltyProgram,
  getUserLoyaltyPoints,
  redeemLoyaltyPoints,
  addLoyaltyPoints,
  createLoyaltyProgram,
  getAllLoyaltyPrograms,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
  getUsersLoyaltyData
} = require('../controllers/loyaltyController');

// Public routes
router.get('/program', getLoyaltyProgram);

// Protected routes
router.get('/my-points', protect, getUserLoyaltyPoints);
router.post('/redeem', protect, redeemLoyaltyPoints);

// Admin routes
router.get('/programs', protect, authorize('admin'), getAllLoyaltyPrograms);
router.post('/programs', protect, authorize('admin'), createLoyaltyProgram);
router.put('/programs/:id', protect, authorize('admin'), updateLoyaltyProgram);
router.delete('/programs/:id', protect, authorize('admin'), deleteLoyaltyProgram);
router.get('/users', protect, authorize('admin'), getUsersLoyaltyData);
router.post('/add-points', protect, authorize('admin'), addLoyaltyPoints);

module.exports = router;