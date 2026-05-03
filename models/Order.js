const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  packageName: { type: String, required: true },
  serviceType: { type: String, default: 'Mini Traveller Bus' },
  seats: [{ type: Number }],
  amount: { type: Number, required: true },
  travelers: { type: Number, default: 1 },
  travelDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'confirmed' },
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)
