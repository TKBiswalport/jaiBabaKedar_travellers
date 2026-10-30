const bcrypt = require('bcryptjs')
const { query, newId, toDoc, insertRow } = require('../config/db')

const PUBLIC_FIELDS = 'id, name, mobile, email, created_at, updated_at'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const User = {
  // Includes the password hash; use only for checking credentials.
  async findByEmailWithPassword(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)])
    return toDoc(rows[0])
  },

  async findByEmail(email) {
    const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE email = $1`, [normalizeEmail(email)])
    return toDoc(rows[0])
  },

  async findById(id) {
    const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id])
    return toDoc(rows[0])
  },

  async findAll() {
    const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY created_at DESC`)
    return rows.map(toDoc)
  },

  async count() {
    const { rows } = await query('SELECT count(*)::int AS n FROM users')
    return rows[0].n
  },

  async create({ name, mobile, email, password }) {
    const row = await insertRow('users', {
      id: newId(),
      name: name.trim(),
      mobile,
      email: normalizeEmail(email),
      password: await bcrypt.hash(password, 10),
    })
    return User.findById(row.id)
  },

  matchPassword(user, entered) {
    return bcrypt.compare(entered, user.password)
  },

  async setResetToken(id, token, expiry) {
    await query(
      'UPDATE users SET reset_token = $2, reset_token_expiry = $3, updated_at = now() WHERE id = $1',
      [id, token, expiry]
    )
  },

  async findByValidResetToken(token) {
    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE reset_token = $1 AND reset_token_expiry > now()`,
      [token]
    )
    return toDoc(rows[0])
  },

  async resetPassword(id, password) {
    await query(
      `UPDATE users SET password = $2, reset_token = NULL, reset_token_expiry = NULL, updated_at = now()
       WHERE id = $1`,
      [id, await bcrypt.hash(password, 10)]
    )
  },
}

module.exports = User
