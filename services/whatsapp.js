const twilio = require('twilio')

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// Normalize Indian phone to E.164 format
function toE164(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}

async function sendWhatsAppMessage(phone, message) {
  const to = `whatsapp:${toE164(phone)}`
  const from = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`
  await client.messages.create({ from, to, body: message })
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function buildAvailableMessage(enquiry) {
  return (
    `🙏 Jai Baba Kedar!\n\n` +
    `Hello ${enquiry.name},\n\n` +
    `✅ Great news! Your *${enquiry.vehicleName}* is *AVAILABLE* for your Char Dham Yatra.\n\n` +
    `📅 Travel Date: ${formatDate(enquiry.travelDate)}\n` +
    `👥 Passengers: ${enquiry.passengers}\n\n` +
    `Please call us to confirm your booking. We look forward to serving you on this sacred journey!\n\n` +
    `_— Team Char Dham Yatra_`
  )
}

function buildNotAvailableMessage(enquiry) {
  return (
    `🙏 Jai Baba Kedar!\n\n` +
    `Hello ${enquiry.name},\n\n` +
    `❌ We regret to inform you that *${enquiry.vehicleName}* is *NOT AVAILABLE* for ${formatDate(enquiry.travelDate)}.\n\n` +
    `Please contact us to explore other vehicle options or alternate dates. We will do our best to arrange the best option for you!\n\n` +
    `_— Team Char Dham Yatra_`
  )
}

module.exports = { sendWhatsAppMessage, buildAvailableMessage, buildNotAvailableMessage }
