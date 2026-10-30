const { query, newId, toDoc, pickColumns, insertRow } = require('../config/db')

const COLUMNS = {
  customerName: 'customer_name',
  title: 'title',
  mediaUrl: 'media_url',
  publicId: 'public_id',
  mediaType: 'media_type',
  thumbnail: 'thumbnail',
}

const Review = {
  async create(data) {
    return toDoc(await insertRow('reviews', { id: newId(), ...pickColumns(data, COLUMNS) }))
  },

  async findAll() {
    const { rows } = await query('SELECT * FROM reviews ORDER BY created_at DESC')
    return rows.map(toDoc)
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [id])
    return toDoc(rows[0])
  },

  async deleteById(id) {
    await query('DELETE FROM reviews WHERE id = $1', [id])
  },
}

module.exports = Review
