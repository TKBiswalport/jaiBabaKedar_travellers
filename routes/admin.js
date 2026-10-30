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
    const [totalUsers, totalOrders, confirmedOrders, revenue, recentOrders, pendingEnquiries] = await Promise.all([
      User.count(),
      Order.count(),
      Order.count('confirmed'),
      Order.confirmedRevenue(),
      Order.findAllWithUser({ limit: 5 }),
      Enquiry.count('pending'),
    ])
    res.json({
      totalUsers,
      totalOrders,
      confirmed: confirmedOrders,
      revenue,
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
    const [users, orders] = await Promise.all([User.findAll(), Order.findAll()])
    const ordersByUser = {}
    for (const order of orders) {
      (ordersByUser[order.user] ||= []).push(order)
    }
    res.json(users.map((u) => {
      const userOrders = ordersByUser[u._id] || []
      return { ...u, orders: userOrders, orderCount: userOrders.length }
    }))
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers' })
  }
})

// GET /api/admin/orders
router.get('/orders', adminProtect, async (req, res) => {
  try {
    const orders = await Order.findAllWithUser()
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

    if (travelDate !== undefined) order.travelDate = new Date(travelDate)

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

    await Order.update(order._id, order)
    const updated = await Order.findByIdWithUser(order._id)
    res.json(updated)
  } catch (err) {
    console.error('Update order error:', err.message)
    res.status(500).json({ message: 'Failed to update order' })
  }
})

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', adminProtect, async (req, res) => {
  try {
    const deleted = await Order.deleteById(req.params.id)
    if (!deleted) return res.status(404).json({ message: 'Order not found' })
    res.json({ message: 'Order deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete order' })
  }
})

// GET /api/admin/enquiries
router.get('/enquiries', adminProtect, async (req, res) => {
  try {
    const enquiries = await Enquiry.findAll()
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

    const enquiry = await Enquiry.update(req.params.id, update)
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
