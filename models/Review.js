const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  title: { type: String, required: true },
  mediaUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  mediaType: { type: String, enum: ['video', 'image'], required: true },
  thumbnail: { type: String },
}, { timestamps: true })

module.exports = mongoose.model('Review', reviewSchema)
