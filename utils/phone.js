// Mobile numbers for sign-up. Indian numbers are stored as 10 digits (as before);
// numbers from other countries are stored with their country code, e.g. +14155552671.

const INDIAN_MOBILE = /^[6-9]\d{9}$/

// Returns the number to store, or null if it is not a valid mobile number.
// Accepts "9876543210", "+91 98765 43210", "+1 (415) 555-2671", "0044 7911 123456", ...
function normalizeMobile(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null
  const raw = String(input).trim()
  let digits = raw.replace(/\D/g, '')

  const hasCountryCode = raw.startsWith('+') || raw.startsWith('00')
  if (!hasCountryCode) {
    // No country code: an Indian mobile, optionally with a leading 0
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
    return INDIAN_MOBILE.test(digits) ? digits : null
  }

  if (raw.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('91')) {
    const local = digits.slice(2)
    return INDIAN_MOBILE.test(local) ? local : null
  }
  // Any other country: country code + number, 7 to 15 digits in total (the international limit)
  return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null
}

module.exports = { normalizeMobile }
