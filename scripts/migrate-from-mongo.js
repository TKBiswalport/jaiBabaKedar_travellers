// One-time copy of all data from MongoDB (MONGO_URI) into PostgreSQL (DATABASE_URL).
// Usage: npm run migrate:mongo
// Safe to re-run: records that already exist in Postgres are skipped.
// IDs are kept, so existing login tokens and order numbers stay the same.

require('dotenv').config()
const mongoose = require('mongoose')
const { pool, connectDB } = require('../config/db')

const str = (v) => (v == null ? null : String(v))
const date = (v, fallback) => (v ? new Date(v) : fallback)

async function insertIgnore(table, values) {
  const cols = Object.keys(values)
  const params = cols.map((_, i) => `$${i + 1}`)
  const { rowCount } = await pool.query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${params.join(', ')}) ON CONFLICT DO NOTHING`,
    Object.values(values)
  )
  return rowCount
}

async function copyCollection(db, collection, table, toRow) {
  const docs = await db.collection(collection).find().toArray()
  const stats = { found: docs.length, copied: 0, skipped: 0, invalid: 0, failed: 0 }
  for (const doc of docs) {
    const row = toRow(doc)
    if (!row) { stats.invalid++; continue }
    try {
      if (await insertIgnore(table, row)) stats.copied++
      else stats.skipped++
    } catch (err) {
      stats.failed++
      console.error(`  ${table} ${doc._id}: ${err.message}`)
    }
  }
  console.log(
    `${table.padEnd(10)} found ${stats.found}, copied ${stats.copied}, already there ${stats.skipped}, ` +
    `skipped ${stats.invalid}, failed ${stats.failed}`
  )
  return stats
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env')

  await connectDB() // creates the tables if needed
  await mongoose.connect(process.env.MONGO_URI)
  const db = mongoose.connection.db
  console.log('MongoDB connected, copying...\n')

  const timestamps = (d) => {
    const created = date(d.createdAt, d._id.getTimestamp())
    return { created_at: created, updated_at: date(d.updatedAt, created) }
  }

  await copyCollection(db, 'users', 'users', (d) => ({
    id: str(d._id),
    name: d.name,
    mobile: d.mobile,
    email: String(d.email).toLowerCase(),
    password: d.password, // already a bcrypt hash
    reset_token: d.resetToken ?? null,
    reset_token_expiry: date(d.resetTokenExpiry, null),
    ...timestamps(d),
  }))

  const { rows } = await pool.query('SELECT id FROM users')
  const userIds = new Set(rows.map((r) => r.id))

  await copyCollection(db, 'orders', 'orders', (d) => {
    if (!userIds.has(str(d.user))) {
      console.warn(`  orders ${d._id}: skipped, its user ${d.user} no longer exists`)
      return null
    }
    return {
      id: str(d._id),
      user_id: str(d.user),
      vehicle_id: d.vehicleId,
      vehicle_name: d.vehicleName,
      seats: (d.seats || []).map(Number).filter(Number.isFinite),
      amount: d.amount,
      travelers: d.travelers ?? 1,
      travel_date: d.travelDate,
      status: d.status ?? 'confirmed',
      package_id: d.packageId ?? null,
      package_title: d.packageTitle ?? null,
      package_duration: d.packageDuration ?? null,
      plan_label: d.planLabel ?? null,
      plan_price: str(d.planPrice),
      ...timestamps(d),
    }
  })

  await copyCollection(db, 'enquiries', 'enquiries', (d) => ({
    id: str(d._id),
    name: d.name,
    phone: d.phone,
    travel_date: d.travelDate,
    passengers: d.passengers ?? 1,
    message: d.message ?? '',
    vehicle_id: d.vehicleId,
    vehicle_name: d.vehicleName,
    package_id: d.packageId ?? null,
    package_title: d.packageTitle ?? null,
    package_duration: d.packageDuration ?? null,
    plan_label: d.planLabel ?? null,
    plan_price: str(d.planPrice),
    status: d.status ?? 'pending',
    availability: d.availability ?? 'pending',
    ...timestamps(d),
  }))

  await copyCollection(db, 'reviews', 'reviews', (d) => ({
    id: str(d._id),
    customer_name: d.customerName,
    title: d.title,
    media_url: d.mediaUrl,
    public_id: d.publicId,
    media_type: d.mediaType,
    thumbnail: d.thumbnail ?? null,
    ...timestamps(d),
  }))

  console.log('\nDone.')
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {})
    await pool.end().catch(() => {})
  })
