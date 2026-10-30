const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString || '')

// SSL is configured below, so drop `sslmode` from the URL (pg warns about it otherwise).
const withoutSslMode = (url) => {
  if (!url) return url
  const parsed = new URL(url)
  parsed.searchParams.delete('sslmode')
  return parsed.toString()
}

const pool = new Pool({
  connectionString: withoutSslMode(connectionString),
  // Hosted Postgres (Neon, Render, ...) needs SSL with a verified certificate; a local database doesn't.
  ssl: isLocal ? false : true,
  max: 10,
})

const query = (text, params) => pool.query(text, params)

// 24-char hex, same format as MongoDB ObjectIds.
const newId = () => crypto.randomBytes(12).toString('hex')

// DB row (snake_case) -> API shape the frontend expects (camelCase, `_id`).
const toDoc = (row) => {
  if (!row) return null
  const doc = {}
  for (const [key, value] of Object.entries(row)) {
    const name = key === 'id' ? '_id' : key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    doc[name] = value
  }
  return doc
}

// Picks the fields present in `data` and maps them to column names via `columns`.
const pickColumns = (data, columns) => {
  const values = {}
  for (const [field, column] of Object.entries(columns)) {
    if (data[field] !== undefined) values[column] = data[field]
  }
  return values
}

const insertRow = async (table, values) => {
  const cols = Object.keys(values)
  const params = cols.map((_, i) => `$${i + 1}`)
  const { rows } = await query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${params.join(', ')}) RETURNING *`,
    Object.values(values)
  )
  return rows[0]
}

const updateRow = async (table, id, values) => {
  const cols = Object.keys(values)
  const sets = cols.map((col, i) => `${col} = $${i + 2}`).concat('updated_at = now()')
  const { rows } = await query(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...Object.values(values)]
  )
  return rows[0] || null
}

const connectDB = async () => {
  if (!connectionString) {
    console.error('PostgreSQL connection failed: DATABASE_URL is not set')
    process.exit(1)
  }
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
    await pool.query(schema)
    const { rows } = await pool.query('SELECT current_database() AS name')
    console.log(`PostgreSQL connected: ${rows[0].name}`)
  } catch (err) {
    console.error(`PostgreSQL connection failed: ${err.message}`)
    process.exit(1)
  }
}

module.exports = { pool, query, newId, toDoc, pickColumns, insertRow, updateRow, connectDB }
