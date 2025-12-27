const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = ['uploads/rooms', 'uploads/avatars'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// Use memory storage for Cloudinary uploads
const memoryStorage = multer.memoryStorage();

// File filter function - allow only jpg, jpeg, png
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, and PNG images are allowed.'), false);
  }
};

// Upload configurations
const uploadRoom = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB limit
  },
  fileFilter: fileFilter
});

const uploadAvatar = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 1024 * 1024 * 2 // 2MB limit for avatars
  },
  fileFilter: fileFilter
});

// Generic upload middleware
const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 1024 * 1024 * 10 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = {
  uploadRoom,
  uploadAvatar,
  upload
};