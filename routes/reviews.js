const router = require('express').Router()
const { cloudinary, upload } = require('../config/cloudinary')
const adminProtect = require('../middleware/adminAuth')
const Review = require('../models/Review')

// GET /api/reviews — public, fetch all reviews
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.findAll()
    res.json(reviews)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews' })
  }
})

// POST /api/reviews — admin only, upload video/image
router.post('/', adminProtect, upload.single('media'), async (req, res) => {
  try {
    const { customerName, title } = req.body
    if (!customerName || !title) return res.status(400).json({ message: 'Customer name and title are required' })
    if (!req.file) return res.status(400).json({ message: 'Media file is required' })

    const isVideo = req.file.mimetype.startsWith('video/')
    const thumbnail = isVideo
      ? cloudinary.url(req.file.filename, { resource_type: 'video', format: 'jpg', transformation: [{ start_offset: '0' }] })
      : null

    const review = await Review.create({
      customerName,
      title,
      mediaUrl: req.file.path,
      publicId: req.file.filename,
      mediaType: isVideo ? 'video' : 'image',
      thumbnail,
    })

    res.status(201).json(review)
  } catch (err) {
    console.error('Review upload error:', err.message)
    res.status(500).json({ message: 'Upload failed. Please try again.' })
  }
})

// DELETE /api/reviews/:id — admin only
router.delete('/:id', adminProtect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review not found' })

    await cloudinary.uploader.destroy(review.publicId, {
      resource_type: review.mediaType === 'video' ? 'video' : 'image',
    })

    await Review.deleteById(review._id)
    res.json({ message: 'Review deleted' })
  } catch (err) {
    console.error('Review delete error:', err.message)
    res.status(500).json({ message: 'Delete failed' })
  }
})

module.exports = router
