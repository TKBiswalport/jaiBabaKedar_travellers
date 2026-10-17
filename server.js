require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')

const app = express()

// CORS configuration - allow Vercel deployments
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://jaibabakedar.com',
  'https://www.jaibabakedar.com',
  'https://admin.jaibabakedar.com'
]

// Allow all Vercel preview deployments
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    // Allow Vercel preview deployments (*.vercel.app)
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true)
    }
    
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}

app.use(cors(corsOptions))
app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/dhams', require('./routes/dhams'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/enquiries', require('./routes/enquiries'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/reviews', require('./routes/reviews'))

app.get('/', (req, res) => res.json({ message: 'CharDham Yatra API running 🕉️' }))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Server error' })
})

const start = async () => {
  await connectDB()
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

start()
