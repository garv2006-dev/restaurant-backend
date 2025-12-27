const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadRoom, uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');
const {
  uploadRoomImages,
  deleteRoomImage,
  setPrimaryRoomImage,
  uploadAvatar,
  deleteAvatar
} = require('../controllers/uploadController');

// Room image routes
router.post('/room-images', protect, authorize('admin'), uploadRoom.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const images = req.files.map((file, index) => ({
      url: `/uploads/rooms/${file.filename}`,
      filename: file.filename,
      altText: `Room Image ${index + 1}`,
      isPrimary: index === 0
    }));

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: { images }
    });
  } catch (error) {
    console.error('Upload room images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images'
    });
  }
});
router.post('/room/:id', protect, authorize('admin'), uploadRoom.array('images', 5), uploadRoomImages);
router.delete('/room/:roomId/image/:imageId', protect, authorize('admin'), deleteRoomImage);
router.put('/room/:roomId/image/:imageId/primary', protect, authorize('admin'), setPrimaryRoomImage);

// Avatar routes
router.post('/avatar', protect, uploadAvatarMiddleware.single('avatar'), uploadAvatar);
router.delete('/avatar', protect, deleteAvatar);

module.exports = router;