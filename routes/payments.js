const crypto = require('crypto')
const router = require('express').Router()
const Razorpay = require('razorpay')
const protect = require('../middleware/auth')
const Order = require('../models/Order')
const { prepareSeatBooking } = require('../utils/booking')

let razorpay = null
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null
  razorpay ||= new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  return razorpay
}

const hmacSha256 = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex')

const signaturesMatch = (expected, received) => {
  const a = Buffer.from(expected)
  const b = Buffer.from(String(received || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// POST /api/payments/create-order: reserves the seats and starts a Razorpay payment.
// The price is worked out here, never taken from the browser.
router.post('/create-order', protect, async (req, res) => {
  const rzp = getRazorpay()
  if (!rzp) {
    console.error('Razorpay keys are not set (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)')
    return res.status(500).json({ message: 'Online payment is not available right now. Please contact us.' })
  }

  let booking = null
  try {
    const { error, booking: details } = await prepareSeatBooking(req.body)
    if (error) return res.status(error.status).json({ message: error.message })

    const amountInPaise = Math.round(details.amount * 100)
    if (amountInPaise < 100) return res.status(400).json({ message: 'Amount must be at least ₹1' })

    booking = await Order.create({ ...details, user: req.user._id, status: 'pending', paymentStatus: 'created' })

    const rzpOrder = await rzp.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: booking._id,
      notes: {
        bookingId: booking._id,
        vehicle: details.vehicleName,
        seats: details.seats.join(', '),
        travelDate: details.travelDate.toISOString().slice(0, 10),
        customer: req.user.email,
      },
    })
    await Order.update(booking._id, { razorpayOrderId: rzpOrder.id })

    res.status(201).json({
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      bookingId: booking._id,
    })
  } catch (err) {
    if (booking) await Order.deleteUnpaid(booking._id, req.user._id).catch(() => {})
    if (err.statusCode === 401) {
      console.error('Razorpay rejected the API keys: check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET')
    } else {
      console.error('Create payment error:', err.statusCode || '', err.error?.description || err.message)
    }
    res.status(500).json({ message: 'Could not start the payment. Please try again.' })
  }
})

// POST /api/payments/verify: called by the browser after a successful payment.
// Confirms the booking only if Razorpay's signature checks out.
router.post('/verify', protect, async (req, res) => {
  const {
    razorpay_order_id: rzpOrderId,
    razorpay_payment_id: rzpPaymentId,
    razorpay_signature: signature,
  } = req.body
  if (!rzpOrderId || !rzpPaymentId || !signature) {
    return res.status(400).json({ message: 'Payment details are missing' })
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ message: 'Online payment is not available right now. Please contact us.' })
  }

  const expected = hmacSha256(process.env.RAZORPAY_KEY_SECRET, `${rzpOrderId}|${rzpPaymentId}`)
  if (!signaturesMatch(expected, signature)) {
    console.warn(`Payment signature mismatch for Razorpay order ${rzpOrderId}`)
    return res.status(400).json({ message: 'Payment could not be verified. If money was deducted, please contact us.' })
  }

  try {
    const order = await Order.markPaid(rzpOrderId, rzpPaymentId, req.user._id)
    if (!order) return res.status(404).json({ message: 'Booking not found for this payment. Please contact us.' })
    res.json(order)
  } catch (err) {
    console.error('Verify payment error:', err.message)
    res.status(500).json({ message: 'Payment received but the booking could not be updated. Please contact us.' })
  }
})

// POST /api/payments/cancel: the customer closed the payment window, so free the seats.
router.post('/cancel', protect, async (req, res) => {
  try {
    const { bookingId } = req.body
    if (!bookingId) return res.status(400).json({ message: 'Booking id is required' })
    await Order.deleteUnpaid(bookingId, req.user._id)
    res.json({ message: 'Seats released' })
  } catch (err) {
    console.error('Cancel payment error:', err.message)
    res.status(500).json({ message: 'Failed to release seats' })
  }
})

// POST /api/payments/webhook: Razorpay calls this after a payment (set up in the Razorpay dashboard).
// Confirms the booking even if the customer closed the browser before /verify ran.
router.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return res.status(503).json({ message: 'Webhook is not configured' })

  const signature = req.headers['x-razorpay-signature']
  if (!req.rawBody || !signaturesMatch(hmacSha256(secret, req.rawBody), signature)) {
    return res.status(400).json({ message: 'Invalid signature' })
  }

  try {
    const { event, payload } = req.body
    const payment = payload?.payment?.entity
    if ((event === 'order.paid' || event === 'payment.captured') && payment?.order_id) {
      const order = await Order.markPaid(payment.order_id, payment.id)
      if (!order) {
        console.warn(`Razorpay payment ${payment.id} (order ${payment.order_id}) has no booking. Check it in the Razorpay dashboard.`)
      }
    }
    res.json({ received: true })
  } catch (err) {
    console.error('Payment webhook error:', err.message)
    res.status(500).json({ message: 'Webhook failed' }) // Razorpay retries failed webhooks
  }
})

module.exports = router
