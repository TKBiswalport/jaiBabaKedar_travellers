const Order = require('../models/Order')
const { getPackagePricePerPerson } = require('./packageInfo')

const VEHICLE_PRICING = {
  'tempo-13': 800,
  'tempo-17': 750,
  'bus-28': 600,
  'bus-32': 550,
}
const SERVICE_FEE = 50

const seatLabel = (s) => `S${String(s).padStart(2, '0')}`

// Checks a seat-booking request from the customer and works out the price on the server.
// Returns { error: { status, message } }, or { booking } ready for Order.create.
async function prepareSeatBooking(body) {
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
  const amount = packagePricePerPerson != null
    ? seats.length * packagePricePerPerson
    : seats.length * (VEHICLE_PRICING[vehicleId] + SERVICE_FEE)

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
