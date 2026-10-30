const router = require('express').Router()
const protect = require('../middleware/auth')
const Order = require('../models/Order')

const VEHICLE_PRICING = {
  'tempo-13': 800,
  'tempo-17': 750,
  'bus-28': 600,
  'bus-32': 550,
}
const SERVICE_FEE = 50

const { getPackagePricePerPerson } = require('../utils/packageInfo')

// GET /api/orders/seats?date=YYYY-MM-DD&vehicleId=tempo-13
router.get('/seats', async (req, res) => {
  try {
    const { date, vehicleId } = req.query
    if (!date || !vehicleId) return res.status(400).json({ message: 'Date and vehicleId are required' })

    const start = new Date(date); start.setHours(0, 0, 0, 0)
    const end = new Date(date); end.setHours(23, 59, 59, 999)

    const orders = await Order.findActiveForVehicle(vehicleId, start, end)

    res.json({ bookedSeats: orders.flatMap((o) => o.seats) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch seats' })
  }
})

// GET /api/orders/my
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.findByUser(req.user._id)
    res.json(orders)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

// POST /api/orders
router.post('/', protect, async (req, res) => {
  try {
    const {
      seats: rawSeats,
      travelDate,
      vehicleId,
      vehicleName,
      packageId,
      packageTitle,
      packageDuration,
      planLabel,
      planPrice,
    } = req.body

    const seats = Array.isArray(rawSeats)
      ? rawSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : []
    if (seats.length === 0) return res.status(400).json({ message: 'Please select at least one seat' })
    if (!travelDate) return res.status(400).json({ message: 'Travel date is required' })
    if (!vehicleId || !VEHICLE_PRICING[vehicleId]) return res.status(400).json({ message: 'Invalid vehicle selected' })

    const packagePricePerPerson = packageId && planLabel
      ? getPackagePricePerPerson(packageId, planLabel)
      : null

    const start = new Date(travelDate); start.setHours(0, 0, 0, 0)
    const end = new Date(travelDate); end.setHours(23, 59, 59, 999)

    const existing = await Order.findActiveForVehicle(vehicleId, start, end, seats)

    if (existing.length > 0) {
      const takenSeats = existing.flatMap((o) => o.seats).filter((s) => seats.includes(s))
      return res.status(409).json({
        message: `Seats ${takenSeats.map((s) => `S${String(s).padStart(2, '0')}`).join(', ')} are already booked for this date`,
      })
    }

    const amount = packagePricePerPerson != null
      ? seats.length * packagePricePerPerson
      : seats.length * (VEHICLE_PRICING[vehicleId] + SERVICE_FEE)

    const order = await Order.create({
      user: req.user._id,
      vehicleId,
      vehicleName: vehicleName || vehicleId,
      seats,
      travelers: seats.length,
      travelDate: new Date(travelDate),
      amount,
      status: 'confirmed',
      packageId: packageId || null,
      packageTitle: packageTitle || null,
      packageDuration: packageDuration || null,
      planLabel: planLabel || null,
      planPrice: planPrice || null,
    })

    res.status(201).json(order)
  } catch (err) {
    console.error('Booking error:', err.message)
    res.status(500).json({ message: 'Booking failed. Please try again.' })
  }
})

module.exports = router
