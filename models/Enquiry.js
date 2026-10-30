const { query, newId, toDoc, pickColumns, insertRow, updateRow } = require('../config/db')

const COLUMNS = {
  name: 'name',
  phone: 'phone',
  travelDate: 'travel_date',
  passengers: 'passengers',
  message: 'message',
  vehicleId: 'vehicle_id',
  vehicleName: 'vehicle_name',
  packageId: 'package_id',
  packageTitle: 'package_title',
  packageDuration: 'package_duration',
  planLabel: 'plan_label',
  planPrice: 'plan_price',
  status: 'status',
  availability: 'availability',
}

const Enquiry = {
  async create(data) {
    return toDoc(await insertRow('enquiries', { id: newId(), ...pickColumns(data, COLUMNS) }))
  },

  async update(id, data) {
    return toDoc(await updateRow('enquiries', id, pickColumns(data, COLUMNS)))
  },

  async findAll() {
    const { rows } = await query('SELECT * FROM enquiries ORDER BY created_at DESC')
    return rows.map(toDoc)
  },

  async count(status) {
    const { rows } = await query('SELECT count(*)::int AS n FROM enquiries WHERE status = $1', [status])
    return rows[0].n
  },
}

module.exports = Enquiry
