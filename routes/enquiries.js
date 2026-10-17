const router = require('express').Router()
const Enquiry = require('../models/Enquiry')

const PRIVATE_VEHICLE_IDS = ['swift-dzire', 'ertiga', 'innova']

// POST /api/enquiries — private vehicle enquiry (no login required)
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phone,
      travelDate,
      passengers,
      message,
      vehicleId,
      vehicleName,
      packageId,
      packageTitle,
      packageDuration,
      planLabel,
      planPrice,
    } = req.body

    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' })
    if (!phone?.trim() || phone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ message: 'Valid phone number is required' })
    }
    if (!travelDate) return res.status(400).json({ message: 'Travel date is required' })
    if (!vehicleId || !PRIVATE_VEHICLE_IDS.includes(vehicleId)) {
      return res.status(400).json({ message: 'Invalid vehicle selected' })
    }

    const enquiry = await Enquiry.create({
      name: name.trim(),
      phone: phone.trim(),
      travelDate,
      passengers: Math.max(1, Number(passengers) || 1),
      message: message?.trim() || '',
      vehicleId,
      vehicleName: vehicleName || vehicleId,
      packageId: packageId || null,
      packageTitle: packageTitle || null,
      packageDuration: packageDuration || null,
      planLabel: planLabel || null,
      planPrice: planPrice || null,
    })

    res.status(201).json({ message: 'Enquiry submitted successfully', enquiry })
  } catch (err) {
    console.error('Enquiry error:', err.message)
    res.status(500).json({ message: 'Failed to submit enquiry. Please try again.' })
  }
})

module.exports = router
