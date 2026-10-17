const router = require('express').Router()
const jwt = require('jsonwebtoken')
const adminProtect = require('../middleware/adminAuth')
const User = require('../models/User')
const Order = require('../models/Order')
const Enquiry = require('../models/Enquiry')
const { getPackagePricePerPerson } = require('../utils/packageInfo')
const { sendWhatsAppMessage, buildAvailableMessage, buildNotAvailableMessage } = require('../services/whatsapp')

const VEHICLE_PRICING = {
  'tempo-13': 800,
  'tempo-17': 750,
  'bus-28': 600,
  'bus-32': 550,
}
const SERVICE_FEE = 50
const VEHICLE_NAMES = {
  'swift-dzire': 'Swift Dzire',
  'ertiga': 'Ertiga',
  'innova': 'Innova',
  'tempo-13': 'Tempo Traveller 13',
  'tempo-17': 'Tempo Traveller 17',
  'bus-28': '2×2 Bus 28',
  'bus-32': '2×2 Bus 32',
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { isAdmin: true, email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )
    return res.json({ token })
  }
  res.status(401).json({ message: 'Invalid admin credentials' })
})

// GET /api/admin/stats
router.get('/stats', adminProtect, async (req, res) => {
  try {
    const [totalUsers, totalOrders, confirmedOrders, revenueData, recentOrders, pendingEnquiries] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'confirmed' }),
      Order.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email'),
      Enquiry.countDocuments({ status: 'pending' }),
    ])
    res.json({
      totalUsers,
      totalOrders,
      confirmed: confirmedOrders,
      revenue: revenueData[0]?.total ?? 0,
      recentOrders,
      pendingEnquiries,
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats' })
  }
})

// GET /api/admin/customers
router.get('/customers', adminProtect, async (req, res) => {
  try {
    const users = await User.find().select('-password -resetToken -resetTokenExpiry').sort({ createdAt: -1 })
    const usersWithOrders = await Promise.all(
      users.map(async (u) => {
        const orders = await Order.find({ user: u._id }).sort({ createdAt: -1 })
        return { ...u.toObject(), orders, orderCount: orders.length }
      })
    )
    res.json(usersWithOrders)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers' })
  }
})

// GET /api/admin/orders
router.get('/orders', adminProtect, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email mobile')
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

// PATCH /api/admin/orders/:id
router.patch('/orders/:id', adminProtect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const {
      packageId,
      packageTitle,
      packageDuration,
      planLabel,
      planPrice,
      vehicleId,
      vehicleName,
      travelDate,
      seats,
      status,
      amount,
    } = req.body

    if (packageId !== undefined) order.packageId = packageId || null
    if (packageTitle !== undefined) order.packageTitle = packageTitle || null
    if (packageDuration !== undefined) order.packageDuration = packageDuration || null
    if (planLabel !== undefined) order.planLabel = planLabel || null
    if (planPrice !== undefined) order.planPrice = planPrice || null

    if (vehicleId !== undefined) {
      if (!VEHICLE_NAMES[vehicleId]) return res.status(400).json({ message: 'Invalid vehicle' })
      order.vehicleId = vehicleId
      order.vehicleName = vehicleName || VEHICLE_NAMES[vehicleId]
    } else if (vehicleName !== undefined) {
      order.vehicleName = vehicleName
    }

    if (travelDate !== undefined) order.travelDate = travelDate

    if (seats !== undefined) {
      const parsed = Array.isArray(seats)
        ? seats.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : []
      order.seats = parsed
      order.travelers = parsed.length || order.travelers
    }

    if (status !== undefined) {
      if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' })
      }
      order.status = status
    }

    if (amount !== undefined && amount !== '') {
      order.amount = Number(amount)
    } else if (order.packageId && order.planLabel && order.seats?.length) {
      const pkgPrice = getPackagePricePerPerson(order.packageId, order.planLabel)
      if (pkgPrice != null) {
        order.amount = order.seats.length * pkgPrice
      } else if (VEHICLE_PRICING[order.vehicleId] && order.seats.length) {
        order.amount = order.seats.length * (VEHICLE_PRICING[order.vehicleId] + SERVICE_FEE)
      }
    }

    await order.save()
    const updated = await Order.findById(order._id).populate('user', 'name email mobile')
    res.json(updated)
  } catch (err) {
    console.error('Update order error:', err.message)
    res.status(500).json({ message: 'Failed to update order' })
  }
})

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', adminProtect, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    res.json({ message: 'Order deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete order' })
  }
})

// GET /api/admin/enquiries
router.get('/enquiries', adminProtect, async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 })
    res.json(enquiries)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch enquiries' })
  }
})

// PATCH /api/admin/enquiries/:id
router.patch('/enquiries/:id', adminProtect, async (req, res) => {
  try {
    const { status, availability } = req.body
    const update = {}

    if (status !== undefined) {
      if (!['pending', 'contacted', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' })
      }
      update.status = status
    }

    if (availability !== undefined) {
      if (!['pending', 'available', 'not_available'].includes(availability)) {
        return res.status(400).json({ message: 'Invalid availability' })
      }
      update.availability = availability
      if (availability !== 'pending') update.status = 'closed'
    }

    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' })

    // Send WhatsApp only when availability is set for the first time
    if (availability === 'available' || availability === 'not_available') {
      try {
        const message = availability === 'available'
          ? buildAvailableMessage(enquiry)
          : buildNotAvailableMessage(enquiry)
        await sendWhatsAppMessage(enquiry.phone, message)
      } catch (waErr) {
        console.error('WhatsApp send failed:', waErr.message)
        // Don't fail the request if WhatsApp fails
      }
    }

    res.json(enquiry)
  } catch (err) {
    res.status(500).json({ message: 'Failed to update enquiry' })
  }
})

module.exports = router
