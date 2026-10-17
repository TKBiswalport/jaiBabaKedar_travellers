const PACKAGE_PLAN_PRICING = {
  munsiyari: { Budget: 12000, Deluxe: 18000, Premium: 30000 },
  chardham: { 'AC Bus / Tempo': 16000, 'Delhi → Delhi': 29500, 'Haridwar → Haridwar': 27000 },
}

function getPackagePricePerPerson(packageId, planLabel) {
  return PACKAGE_PLAN_PRICING[packageId]?.[planLabel] ?? null
}

function buildPackageName({ packageTitle, planLabel, planPrice }) {
  if (!packageTitle) return null
  const parts = [packageTitle]
  if (planLabel) parts.push(planLabel)
  if (planPrice) parts.push(planPrice)
  return parts.join(' · ')
}

module.exports = { PACKAGE_PLAN_PRICING, getPackagePricePerPerson, buildPackageName }
