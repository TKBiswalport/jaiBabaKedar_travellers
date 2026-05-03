const router = require('express').Router()

const dhams = [
  {
    id: 1,
    name: 'Yamunotri',
    deity: 'Goddess Yamuna',
    altitude: '3293m',
    state: 'Uttarakhand',
    description: 'Source of the Yamuna river and seat of Goddess Yamuna.',
    bestTime: 'May - June, September - October',
  },
  {
    id: 2,
    name: 'Gangotri',
    deity: 'Goddess Ganga',
    altitude: '3100m',
    state: 'Uttarakhand',
    description: 'Origin of the holy Ganges river, dedicated to Goddess Ganga.',
    bestTime: 'May - June, September - October',
  },
  {
    id: 3,
    name: 'Kedarnath',
    deity: 'Lord Shiva',
    altitude: '3583m',
    state: 'Uttarakhand',
    description: 'One of the 12 Jyotirlingas, nestled in the Himalayas.',
    bestTime: 'May - June, September - October',
  },
  {
    id: 4,
    name: 'Badrinath',
    deity: 'Lord Vishnu',
    altitude: '3133m',
    state: 'Uttarakhand',
    description: 'Sacred abode of Lord Vishnu on the banks of Alaknanda river.',
    bestTime: 'May - June, September - October',
  },
]

// GET /api/dhams
router.get('/', (req, res) => res.json(dhams))

// GET /api/dhams/:id
router.get('/:id', (req, res) => {
  const dham = dhams.find((d) => d.id === parseInt(req.params.id))
  if (!dham) return res.status(404).json({ message: 'Dham not found' })
  res.json(dham)
})

module.exports = router
