const Settings = require('../models/Settings');

// @desc    Get global settings (GST, etc)
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne({ type: 'tax' });

        // Create default if not exists
        if (!settings) {
            settings = await Settings.create({
                type: 'tax',
                gstPercentage: 18
            });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching settings'
        });
    }
};

// @desc    Update global settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const { gstPercentage } = req.body;

        if (gstPercentage === undefined || gstPercentage < 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid GST percentage'
            });
        }

        let settings = await Settings.findOne({ type: 'tax' });

        if (!settings) {
            settings = new Settings({ type: 'tax' });
        }

        settings.gstPercentage = gstPercentage;
        settings.updatedBy = req.user.id;
        settings.updatedAt = Date.now();

        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating settings'
        });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
