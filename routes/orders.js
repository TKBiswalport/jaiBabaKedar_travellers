const router = require('express').Router()
const protect = require('../middleware/auth')
const Order = require('../models/Order')

// GET /api/orders/seats?date=YYYY-MM-DD  — fetch booked seat numbers for a date
router.get('/seats', async (req, res) => {
  try {
    const { date } = req.query
    if (!date) return res.status(400).json({ message: 'Date is required' })

    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const orders = await Order.find({
      travelDate: { $gte: start, $lte: end },
      serviceType: 'Mini Traveller Bus',
      status: { $ne: 'cancelled' },
    }).select('seats')

    const bookedSeats = orders.flatMap((o) => o.seats)
    res.json({ bookedSeats })
  } catch (err) {
    console.error('Seats fetch error:', err.message)
    res.status(500).json({ message: 'Failed to fetch seats' })
  }
})

// GET /api/orders/my  — get logged-in user's orders
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json(orders)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

// POST /api/orders  — create a new seat booking
router.post('/', protect, async (req, res) => {
  try {
    const { seats, travelDate } = req.body

    if (!seats || seats.length === 0)
      return res.status(400).json({ message: 'Please select at least one seat' })
    if (!travelDate)
      return res.status(400).json({ message: 'Travel date is required' })

    // Check if any selected seat is already booked for that date
    const start = new Date(travelDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(travelDate)
    end.setHours(23, 59, 59, 999)

    const existing = await Order.find({
      travelDate: { $gte: start, $lte: end },
      serviceType: 'Mini Traveller Bus',
      status: { $ne: 'cancelled' },
      seats: { $in: seats },
    })

    if (existing.length > 0) {
      const takenSeats = existing.flatMap((o) => o.seats).filter((s) => seats.includes(s))
      return res.status(409).json({
        message: `Seats ${takenSeats.map((s) => `S${String(s).padStart(2, '0')}`).join(', ')} are already booked for this date`,
      })
    }

    const PRICE_PER_SEAT = 1200
    const SERVICE_FEE = 50
    const amount = seats.length * (PRICE_PER_SEAT + SERVICE_FEE)

    const order = await Order.create({
      user: req.user._id,
      packageName: 'Mini Traveller Bus - Char Dham Yatra',
      serviceType: 'Mini Traveller Bus',
      seats,
      travelers: seats.length,
      travelDate,
      amount,
      status: 'confirmed',
    })

    res.status(201).json(order)
  } catch (err) {
    console.error('Booking error:', err.message)
    res.status(500).json({ message: 'Booking failed. Please try again.' })
  }
})

module.exports = router
