const jwt = require('jsonwebtoken')

const adminProtect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Not authorized' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded.isAdmin) return res.status(403).json({ message: 'Admin access only' })
    req.admin = decoded
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = adminProtect
