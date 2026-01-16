const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['tax', 'general'],
        default: 'tax'
    },
    gstPercentage: {
        type: Number,
        required: true,
        default: 18
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
