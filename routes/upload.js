const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const { uploadRoom, uploadMenu, uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');
const {
  uploadRoomImages,
  deleteRoomImage,
  setPrimaryRoomImage,
  uploadMenuImage,
  deleteMenuImage,
  uploadAvatar,
  deleteAvatar
} = require('../controllers/uploadController');

// Room image routes
router.post('/room/:id', protect, admin, uploadRoom.array('images', 5), uploadRoomImages);
router.delete('/room/:roomId/image/:imageId', protect, admin, deleteRoomImage);
router.put('/room/:roomId/image/:imageId/primary', protect, admin, setPrimaryRoomImage);

// Menu image routes
router.post('/menu/:id', protect, admin, uploadMenu.single('image'), uploadMenuImage);
router.delete('/menu/:id/image', protect, admin, deleteMenuImage);

// Avatar routes
router.post('/avatar', protect, uploadAvatarMiddleware.single('avatar'), uploadAvatar);
router.delete('/avatar', protect, deleteAvatar);

module.exports = router;