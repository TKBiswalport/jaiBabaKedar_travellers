const cloudinary = require('cloudinary').v2
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/')
    return {
      folder: 'jaibabakedar/reviews',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: ['mp4', 'mov', 'webm', 'jpg', 'jpeg', 'png', 'webp'],
    }
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
})

module.exports = { cloudinary, upload }
