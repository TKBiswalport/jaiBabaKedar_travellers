const { query, newId, toDoc, pickColumns, insertRow, updateRow } = require('../config/db')
const { buildPackageName } = require('../utils/packageInfo')

const COLUMNS = {
  vehicleId: 'vehicle_id',
  vehicleName: 'vehicle_name',
  seats: 'seats',
  amount: 'amount',
  travelers: 'travelers',
  travelDate: 'travel_date',
  status: 'status',
  packageId: 'package_id',
  packageTitle: 'package_title',
  packageDuration: 'package_duration',
  planLabel: 'plan_label',
  planPrice: 'plan_price',
}

const WITH_USER = `
  SELECT o.*, u.name AS u_name, u.email AS u_email, u.mobile AS u_mobile
  FROM orders o LEFT JOIN users u ON u.id = o.user_id`

// `user` is the user's id, or { _id, name, email, mobile } when the row was joined with users.
function toOrder(row) {
  if (!row) return null
  const { user_id, u_name, u_email, u_mobile, ...rest } = row
  const order = toDoc(rest)
  order.user = 'u_name' in row
    ? (u_name == null ? null : { _id: user_id, name: u_name, email: u_email, mobile: u_mobile })
    : user_id
  order.id = order._id
  order.packageName = buildPackageName(order)
  return order
}

const Order = {
  async create(data) {
    const row = await insertRow('orders', { id: newId(), user_id: data.user, ...pickColumns(data, COLUMNS) })
    return toOrder(row)
  },

  async update(id, data) {
    return toOrder(await updateRow('orders', id, pickColumns(data, COLUMNS)))
  },

  async deleteById(id) {
    const { rowCount } = await query('DELETE FROM orders WHERE id = $1', [id])
    return rowCount > 0
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [id])
    return toOrder(rows[0])
  },

  async findByIdWithUser(id) {
    const { rows } = await query(`${WITH_USER} WHERE o.id = $1`, [id])
    return toOrder(rows[0])
  },

  async findAllWithUser({ limit } = {}) {
    const { rows } = limit
      ? await query(`${WITH_USER} ORDER BY o.created_at DESC LIMIT $1`, [limit])
      : await query(`${WITH_USER} ORDER BY o.created_at DESC`)
    return rows.map(toOrder)
  },

  async findAll() {
    const { rows } = await query('SELECT * FROM orders ORDER BY created_at DESC')
    return rows.map(toOrder)
  },

  async findByUser(userId) {
    const { rows } = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId])
    return rows.map(toOrder)
  },

  // Non-cancelled orders for a vehicle between `start` and `end`.
  // Pass `seats` to get only the orders holding any of those seats.
  async findActiveForVehicle(vehicleId, start, end, seats) {
    const sql = `SELECT * FROM orders
      WHERE vehicle_id = $1 AND travel_date BETWEEN $2 AND $3 AND status <> 'cancelled'`
    const { rows } = seats
      ? await query(`${sql} AND seats && $4::int[]`, [vehicleId, start, end, seats])
      : await query(sql, [vehicleId, start, end])
    return rows.map(toOrder)
  },

  async count(status) {
    const { rows } = status
      ? await query('SELECT count(*)::int AS n FROM orders WHERE status = $1', [status])
      : await query('SELECT count(*)::int AS n FROM orders')
    return rows[0].n
  },

  async confirmedRevenue() {
    const { rows } = await query(
      `SELECT COALESCE(SUM(amount), 0)::float AS total FROM orders WHERE status = 'confirmed'`
    )
    return rows[0].total
  },
}

module.exports = Order
