const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = ['uploads/rooms', 'uploads/menu', 'uploads/avatars'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// Room images storage configuration
const roomStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/rooms/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `room-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Menu images storage configuration
const menuStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/menu/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `menu-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Avatar storage configuration
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

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
  storage: roomStorage,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB limit
  },
  fileFilter: fileFilter
});

const uploadMenu = multer({
  storage: menuStorage,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB limit
  },
  fileFilter: fileFilter
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 1024 * 1024 * 2 // 2MB limit for avatars
  },
  fileFilter: fileFilter
});

// Generic upload middleware
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 1024 * 1024 * 10 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = {
  uploadRoom,
  uploadMenu,
  uploadAvatar,
  upload
};