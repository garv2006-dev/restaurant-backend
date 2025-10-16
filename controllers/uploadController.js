const Room = require('../models/Room');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// @desc    Upload room images
// @route   POST /api/upload/room/:id
// @access  Private/Admin
const uploadRoomImages = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Process uploaded images
    const images = req.files.map((file, index) => ({
      url: `/uploads/rooms/${file.filename}`,
      altText: `${room.name} - Image ${index + 1}`,
      isPrimary: index === 0 && room.images.length === 0
    }));

    // Add new images to room
    room.images.push(...images);
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        images: images,
        totalImages: room.images.length
      }
    });

  } catch (error) {
    console.error('Upload room images error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete room image
// @route   DELETE /api/upload/room/:roomId/image/:imageId
// @access  Private/Admin
const deleteRoomImage = async (req, res) => {
  try {
    const { roomId, imageId } = req.params;
    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const imageIndex = room.images.findIndex(img => img._id.toString() === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const image = room.images[imageIndex];
    const imagePath = path.join(__dirname, '..', image.url);
    
    // Delete file from filesystem
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Remove image from room
    room.images.splice(imageIndex, 1);
    
    // If deleted image was primary and there are other images, make first one primary
    if (image.isPrimary && room.images.length > 0) {
      room.images[0].isPrimary = true;
    }
    
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Delete room image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Set primary room image
// @route   PUT /api/upload/room/:roomId/image/:imageId/primary
// @access  Private/Admin
const setPrimaryRoomImage = async (req, res) => {
  try {
    const { roomId, imageId } = req.params;
    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Reset all images to non-primary
    room.images.forEach(img => {
      img.isPrimary = false;
    });

    // Set selected image as primary
    const targetImage = room.images.find(img => img._id.toString() === imageId);
    
    if (!targetImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    targetImage.isPrimary = true;
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Primary image updated successfully'
    });

  } catch (error) {
    console.error('Set primary room image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Upload menu item image
// @route   POST /api/upload/menu/:id
// @access  Private/Admin
const uploadMenuImage = async (req, res) => {
  try {
    const { id } = req.params;
    const menuItem = await MenuItem.findById(id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old image if exists
    if (menuItem.image) {
      const oldImagePath = path.join(__dirname, '..', menuItem.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update menu item with new image
    menuItem.image = `/uploads/menu/${req.file.filename}`;
    await menuItem.save();

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        imageUrl: menuItem.image
      }
    });

  } catch (error) {
    console.error('Upload menu image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete menu item image
// @route   DELETE /api/upload/menu/:id/image
// @access  Private/Admin
const deleteMenuImage = async (req, res) => {
  try {
    const { id } = req.params;
    const menuItem = await MenuItem.findById(id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    if (!menuItem.image) {
      return res.status(400).json({
        success: false,
        message: 'No image to delete'
      });
    }

    // Delete file from filesystem
    const imagePath = path.join(__dirname, '..', menuItem.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Remove image from menu item
    menuItem.image = null;
    await menuItem.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Delete menu image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Upload user avatar
// @route   POST /api/upload/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Delete old avatar if exists and not default
    if (user.avatar && user.avatar !== 'avatar-default.png') {
      const oldAvatarPath = path.join(__dirname, '..', 'uploads/avatars', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update user with new avatar
    user.avatar = req.file.filename;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatarUrl: `/uploads/avatars/${user.avatar}`
      }
    });

  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete user avatar
// @route   DELETE /api/upload/avatar
// @access  Private
const deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.avatar || user.avatar === 'avatar-default.png') {
      return res.status(400).json({
        success: false,
        message: 'No custom avatar to delete'
      });
    }

    // Delete file from filesystem
    const avatarPath = path.join(__dirname, '..', 'uploads/avatars', user.avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    // Reset to default avatar
    user.avatar = 'avatar-default.png';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

module.exports = {
  uploadRoomImages,
  deleteRoomImage,
  setPrimaryRoomImage,
  uploadMenuImage,
  deleteMenuImage,
  uploadAvatar,
  deleteAvatar
};