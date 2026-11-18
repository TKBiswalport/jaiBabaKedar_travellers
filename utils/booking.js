const Order = require('../models/Order')
const { getPackagePricePerPerson } = require('./packageInfo')

const VEHICLE_PRICING = {
  'tempo-13': 800,
  'tempo-17': 750,
  'bus-28': 600,
  'bus-32': 550,
}
const SERVICE_FEE = 50

// Payment testing: on the server set TEST_BOOKING_PRICE=1 and TEST_BOOKING_EMAILS=you@example.com
// (several emails separated by commas). Only those accounts pay the test price; everyone else pays
// the real price. Remove both once testing is done.
const testEmails = () =>
  (process.env.TEST_BOOKING_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
const testPrice = () => {
  const price = Number(process.env.TEST_BOOKING_PRICE)
  return price > 0 ? price : 0
}
function testPriceFor(email) {
  if (!testPrice() || !email) return 0
  return testEmails().includes(String(email).trim().toLowerCase()) ? testPrice() : 0
}
if (testPrice() && testEmails().length) {
  console.warn(`TEST_BOOKING_PRICE is on: ${testEmails().length} test account(s) pay ₹${testPrice()} per booking. Remove it when testing is done.`)
} else if (testPrice()) {
  console.warn('TEST_BOOKING_PRICE is set but TEST_BOOKING_EMAILS is empty, so every booking uses the real price.')
}

const seatLabel = (s) => `S${String(s).padStart(2, '0')}`

// Checks a seat-booking request from the customer and works out the price on the server.
// Returns { error: { status, message } }, or { booking } ready for Order.create.
// `user` is the logged-in customer (used for the TEST_BOOKING_PRICE check).
async function prepareSeatBooking(body, user) {
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
  } = body

  const seats = Array.isArray(rawSeats)
    ? [...new Set(rawSeats.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : []
  if (seats.length === 0) return { error: { status: 400, message: 'Please select at least one seat' } }
  if (!travelDate || Number.isNaN(new Date(travelDate).getTime())) {
    return { error: { status: 400, message: 'Travel date is required' } }
  }
  if (!vehicleId || !VEHICLE_PRICING[vehicleId]) return { error: { status: 400, message: 'Invalid vehicle selected' } }

  const start = new Date(travelDate); start.setHours(0, 0, 0, 0)
  const end = new Date(travelDate); end.setHours(23, 59, 59, 999)

  const existing = await Order.findActiveForVehicle(vehicleId, start, end, seats)
  if (existing.length > 0) {
    const takenSeats = existing.flatMap((o) => o.seats).filter((s) => seats.includes(s))
    return {
      error: { status: 409, message: `Seats ${takenSeats.map(seatLabel).join(', ')} are already booked for this date` },
    }
  }

  const packagePricePerPerson = packageId && planLabel
    ? getPackagePricePerPerson(packageId, planLabel)
    : null
  const realAmount = packagePricePerPerson != null
    ? seats.length * packagePricePerPerson
    : seats.length * (VEHICLE_PRICING[vehicleId] + SERVICE_FEE)
  const amount = testPriceFor(user?.email) || realAmount

  return {
    booking: {
      vehicleId,
      vehicleName: vehicleName || vehicleId,
      seats,
      travelers: seats.length,
      travelDate: new Date(travelDate),
      amount,
      packageId: packageId || null,
      packageTitle: packageTitle || null,
      packageDuration: packageDuration || null,
      planLabel: planLabel || null,
      planPrice: planPrice || null,
    },
  }
}

module.exports = { VEHICLE_PRICING, SERVICE_FEE, prepareSeatBooking }
