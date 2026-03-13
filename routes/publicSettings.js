const express = require('express');
const router = express.Router();
const { getPublicSettings } = require('../controllers/settingsController');

// @route   GET /api/public-settings
// @access  Public
router.get('/', getPublicSettings);

module.exports = router;
