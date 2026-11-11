const bcrypt = require('bcryptjs')
const { query, newId, toDoc, insertRow } = require('../config/db')

const PUBLIC_FIELDS = 'id, name, mobile, email, created_at, updated_at'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

// Where each sign-in provider's account id is stored.
const SOCIAL_ID_COLUMNS = { google: 'google_id', facebook: 'facebook_id' }

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

  // Google / Facebook sign-in. Finds the account for that profile, links it to an existing
  // account with the same email (both providers confirm the email), or creates a new account.
  // Returns { user, created }.
  async findOrCreateSocial(provider, { providerId, email, name }) {
    const column = SOCIAL_ID_COLUMNS[provider]
    if (!column) throw new Error(`Unknown sign-in provider: ${provider}`)
    const findByProviderId = async () => {
      const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE ${column} = $1`, [providerId])
      return toDoc(rows[0])
    }

    const existing = await findByProviderId()
    if (existing) return { user: existing, created: false }

    const { rows: linked } = await query(
      `UPDATE users SET ${column} = $2, updated_at = now()
       WHERE email = $1 AND ${column} IS NULL
       RETURNING ${PUBLIC_FIELDS}`,
      [normalizeEmail(email), providerId]
    )
    if (linked[0]) return { user: toDoc(linked[0]), created: false }

    try {
      const row = await insertRow('users', {
        id: newId(),
        name: name.trim(),
        email: normalizeEmail(email),
        [column]: providerId,
      })
      return { user: await User.findById(row.id), created: true }
    } catch (err) {
      // 23505 = duplicate. Either the same sign-in arrived twice at once (the other request
      // created the account), or the email belongs to an account linked to a different profile.
      if (err.code !== '23505') throw err
      const createdMeanwhile = await findByProviderId()
      if (createdMeanwhile) return { user: createdMeanwhile, created: false }
      throw err
    }
  },

  // Accounts made with Google / Facebook have no password until the person sets one.
  matchPassword(user, entered) {
    if (!user.password) return Promise.resolve(false)
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
