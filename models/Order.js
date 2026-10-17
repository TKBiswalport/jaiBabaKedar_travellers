const mongoose = require('mongoose')

const VEHICLE_IDS = ['swift-dzire', 'ertiga', 'innova', 'tempo-13', 'tempo-17', 'bus-28', 'bus-32']

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicleId: { type: String, enum: VEHICLE_IDS, required: true },
  vehicleName: { type: String, required: true },
  seats: [{ type: Number }],
  amount: { type: Number, required: true },
  travelers: { type: Number, default: 1 },
  travelDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'confirmed' },
  packageId: { type: String, default: null },
  packageTitle: { type: String, default: null },
  packageDuration: { type: String, default: null },
  planLabel: { type: String, default: null },
  planPrice: { type: String, default: null },
}, { timestamps: true })

orderSchema.virtual('packageName').get(function () {
  if (!this.packageTitle) return null
  const parts = [this.packageTitle]
  if (this.planLabel) parts.push(this.planLabel)
  if (this.planPrice) parts.push(this.planPrice)
  return parts.join(' · ')
})

orderSchema.set('toJSON', { virtuals: true })
orderSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('Order', orderSchema)
