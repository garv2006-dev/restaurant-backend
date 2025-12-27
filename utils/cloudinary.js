const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dnnx2sedu',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {String} folderPath - Folder path in Cloudinary (e.g., 'Restaurant/rooms', 'Restaurant/menu')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Upload result with secure_url
 */
const uploadToCloudinary = (fileBuffer, folderPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: options.resource_type || 'auto',
        ...options
      },  
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          console.log(`✅ Successfully uploaded to Cloudinary: ${result}`);
          resolve(result);
        }
      }
    );
    
    stream.end(fileBuffer);
  });
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Public ID of the file in Cloudinary
 * @param {String} resourceType - Type of resource (image, video)
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Get public ID from Cloudinary URL
 * @param {String} url - Cloudinary URL
 * @returns {String} Public ID
 */
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  try {
    // Extract public ID from URL
    // URL format: https://res.cloudinary.com/dnnx2sedu/image/upload/v1234567890/Restaurant/folder/filename.ext
    const urlParts = url.split('/');
    
    // Find the index where 'upload' appears and get everything after version number
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    if (uploadIndex === -1) return null;
    
    // Join from version number onwards and remove file extension
    const publicIdWithVersion = urlParts.slice(uploadIndex + 2).join('/');
    const publicId = publicIdWithVersion.split('.')[0];
    
    return publicId;
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
    return null;
  }
};

/**
 * Upload room images to Cloudinary
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {String} roomId - Room ID for naming
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadRoomImage = async (fileBuffer, roomId, options = {}) => {
  const folderPath = 'Restaurant/rooms';
  const filename = `room-${roomId}-${Date.now()}`;
  
  return uploadToCloudinary(fileBuffer, folderPath, {
    public_id: filename,
    ...options
  });
};


/**
 * Upload user avatar to Cloudinary
 * @param {Buffer} fileBuffer - Avatar file buffer
 * @param {String} userId - User ID for naming
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadAvatar = async (fileBuffer, userId, options = {}) => {
  const folderPath = 'Restaurant/avatars';
  const filename = `avatar-${userId}-${Date.now()}`;
  
  return uploadToCloudinary(fileBuffer, folderPath, {
    public_id: filename,
    ...options
  });
};

/**
 * Delete room image from Cloudinary
 * @param {String} roomImageUrl - Image URL
 * @returns {Promise<Object>} Deletion result
 */
const deleteRoomImage = async (roomImageUrl) => {
  const publicId = getPublicIdFromUrl(roomImageUrl);
  if (!publicId) {
    throw new Error('Invalid image URL');
  }
  return deleteFromCloudinary(publicId, 'image');
};


/**
 * Delete user avatar from Cloudinary
 * @param {String} avatarUrl - Avatar URL
 * @returns {Promise<Object>} Deletion result
 */
const deleteAvatar = async (avatarUrl) => {
  const publicId = getPublicIdFromUrl(avatarUrl);
  if (!publicId) {
    throw new Error('Invalid avatar URL');
  }
  return deleteFromCloudinary(publicId, 'image');
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
  uploadRoomImage,
  uploadAvatar,
  deleteRoomImage,
  deleteAvatar
};
