# Cloudinary Setup Guide

## Folder Structure in Cloudinary

Your images will be organized in the following folder structure in Cloudinary:

```
Restaurant/
├── rooms/          → Room images
├── menu/           → Menu item images
└── avatars/        → User profile avatars
```

## Environment Variables Required

Add the following environment variables to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=dnnx2sedu
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

## Getting Cloudinary Credentials

1. Go to https://cloudinary.com
2. Sign up or log in to your account
3. Go to Dashboard/Settings
4. Copy your:
   - Cloud Name
   - API Key
   - API Secret

## Install Required Package

```bash
npm install cloudinary
```

## Update Multer Configuration

The upload middleware now needs to be updated to use `buffer` storage instead of disk storage:

**backend/middleware/upload.js** should be updated to:

```javascript
const multer = require('multer');

// Storage configuration for memory (buffer) storage
// Files will be held in memory briefly before uploading to Cloudinary
const storage = multer.memoryStorage();

// File filter function - allow only jpg, jpeg, png, gif
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and GIF files are allowed'), false);
  }
};

// Multer configurations
const uploadRoomImages = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadMenuImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadAvatar = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit for avatars
});

module.exports = {
  uploadRoomImages,
  uploadMenuImage,
  uploadAvatar
};
```

## API Responses

### Upload Room Images
```javascript
POST /api/upload/room/:id
Response:
{
  "success": true,
  "message": "Images uploaded successfully",
  "data": {
    "images": [
      {
        "url": "https://res.cloudinary.com/dnnx2sedu/image/upload/v.../Restaurant/rooms/...",
        "publicId": "Restaurant/rooms/room-id-timestamp",
        "altText": "Room Name - Image 1",
        "isPrimary": true
      }
    ],
    "totalImages": 1
  }
}
```

### Upload Menu Image
```javascript
POST /api/upload/menu/:id
Response:
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageUrl": "https://res.cloudinary.com/dnnx2sedu/image/upload/v.../Restaurant/menu/..."
  }
}
```

### Upload Avatar
```javascript
POST /api/upload/avatar
Response:
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatarUrl": "https://res.cloudinary.com/dnnx2sedu/image/upload/v.../Restaurant/avatars/..."
  }
}
```

## Benefits of Using Cloudinary

1. **Cloud Storage**: No need to manage server disk space
2. **CDN**: Images are served globally with low latency
3. **Automatic Optimization**: Images are optimized for different devices
4. **Folder Organization**: Images are organized by type (rooms, menu, avatars)
5. **Easy Management**: Manage all images from Cloudinary dashboard
6. **Transformations**: Apply filters, resize, crop, etc. on the fly
7. **Backup**: Cloud-based backup and redundancy

## Using Image Transformations

You can transform images on the fly by modifying the Cloudinary URL:

```javascript
// Resize image
https://res.cloudinary.com/dnnx2sedu/image/upload/w_300,h_300,c_fill/v.../image.jpg

// Optimize for web
https://res.cloudinary.com/dnnx2sedu/image/upload/q_auto,f_auto/v.../image.jpg

// Apply filter
https://res.cloudinary.com/dnnx2sedu/image/upload/e_grayscale/v.../image.jpg
```

## Updating Models

Update your Room and MenuItem models to include `imagePublicId` fields:

### Room Model
```javascript
images: [{
  url: { type: String, required: true },
  publicId: String,  // NEW
  altText: String,
  isPrimary: Boolean
}]
```

### MenuItem Model
```javascript
image: String,            // URL from Cloudinary
imagePublicId: String,    // NEW - for deletion
```

### User Model
```javascript
avatar: { type: String, default: 'avatar-default.png' },
avatarPublicId: String    // NEW - for deletion
```

## Testing Upload Functionality

```bash
# Test room image upload
curl -X POST http://localhost:5000/api/upload/room/ROOM_ID \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test menu image upload
curl -X POST http://localhost:5000/api/upload/menu/MENU_ID \
  -F "file=@/path/to/image.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test avatar upload
curl -X POST http://localhost:5000/api/upload/avatar \
  -F "file=@/path/to/avatar.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Error: "ENOENT: no such file or directory"
This means the code is still trying to access local files. Make sure you've updated the upload controller to use Cloudinary functions.

### Error: "Cannot find module 'cloudinary'"
Run: `npm install cloudinary`

### Images not uploading to Cloudinary
1. Check that environment variables are set correctly
2. Verify Cloudinary credentials
3. Check browser console and server logs for errors
4. Ensure multer is configured with `memoryStorage`

### Need to batch operations?
Use Cloudinary Admin API for bulk deletions, migrations, etc.
