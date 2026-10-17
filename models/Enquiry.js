const mongoose = require('mongoose')

const PRIVATE_VEHICLE_IDS = ['swift-dzire', 'ertiga', 'innova']

const enquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  travelDate: { type: Date, required: true },
  passengers: { type: Number, default: 1, min: 1 },
  message: { type: String, default: '' },
  vehicleId: { type: String, enum: PRIVATE_VEHICLE_IDS, required: true },
  vehicleName: { type: String, required: true },
  packageId: { type: String, default: null },
  packageTitle: { type: String, default: null },
  packageDuration: { type: String, default: null },
  planLabel: { type: String, default: null },
  planPrice: { type: String, default: null },
  status: { type: String, enum: ['pending', 'contacted', 'closed'], default: 'pending' },
  availability: { type: String, enum: ['pending', 'available', 'not_available'], default: 'pending' },
}, { timestamps: true })

module.exports = mongoose.model('Enquiry', enquirySchema)
