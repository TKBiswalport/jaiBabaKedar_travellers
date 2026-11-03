const router = require('express').Router()
const protect = require('../middleware/auth')
const Order = require('../models/Order')

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

// POST /api/orders: bookings now go through payment (/api/payments/create-order).
// Kept so an old, cached version of the site gets a clear message instead of a 404.
router.post('/', protect, (req, res) => {
  res.status(410).json({ message: 'Please refresh the page and try booking again.' })
})

module.exports = router
