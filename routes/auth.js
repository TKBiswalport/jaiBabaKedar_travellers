const router = require('express').Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const User = require('../models/User')
const { SocialAuthError, socialConfig, verifyGoogle, verifyFacebook } = require('../services/socialAuth')

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
})

const sendMail = async (options) => {
  try {
    await transporter.sendMail(options)
  } catch (err) {
    console.error('Email error:', err.message)
  }
}

// Non-blocking: the account works even if the email can't be sent.
const sendWelcomeEmail = (name, email) =>
  sendMail({
    from: `"CharDham Yatra 🕉️" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to CharDham Yatra! 🙏',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;background:#18181b;color:#fff;border-radius:16px;padding:32px;">
        <h1 style="color:#f97316;text-align:center;">🕉️ CharDhamYatra</h1>
        <h2 style="text-align:center;">Welcome, ${name}! 🙏</h2>
        <p style="color:#a1a1aa;text-align:center;">Your sacred journey begins here. We're thrilled to have you as part of our pilgrim family.</p>
        <p style="color:#a1a1aa;text-align:center;">May your Char Dham Yatra be blessed and fulfilling.</p>
        <p style="text-align:center;margin-top:24px;color:#f97316;">Jai Badri Vishal 🙏</p>
      </div>
    `,
  })

const authResponse = (user) => ({
  token: generateToken(user._id),
  user: { id: user._id, name: user.name, email: user.email, mobile: user.mobile },
})

// GET /api/auth/health - Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auth service is running', timestamp: new Date().toISOString() })
})

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt:', { email: req.body.email, name: req.body.name })
    
    const { name, mobile, email, password } = req.body
    
    // Validate input
    if (!name || !mobile || !email || !password) {
      console.log('Validation failed: Missing fields')
      return res.status(400).json({ message: 'All fields are required' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('Validation failed: Invalid email format')
      return res.status(400).json({ message: 'Invalid email format' })
    }

    // Validate mobile format
    const mobileRegex = /^[6-9]\d{9}$/
    if (!mobileRegex.test(mobile)) {
      console.log('Validation failed: Invalid mobile format')
      return res.status(400).json({ message: 'Invalid mobile number. Must be 10 digits starting with 6-9' })
    }

    // Validate password length
    if (password.length < 6) {
      console.log('Validation failed: Password too short')
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    // Check if user exists
    const exists = await User.findByEmail(email)
    if (exists) {
      console.log('Registration failed: Email already exists')
      return res.status(400).json({ message: 'Email already registered' })
    }

    // Create user
    const user = await User.create({ name, mobile, email, password })
    console.log('User created successfully:', user._id)

    sendWelcomeEmail(name, email)

    res.status(201).json(authResponse(user))
  } catch (err) {
    console.error('Register error:', err)
    
    // Unique email violation (two sign-ups racing each other)
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Email already registered' })
    }


    res.status(500).json({ message: 'Server error. Please try again later.' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email })
    
    const { email, password } = req.body
    
    if (!email || !password) {
      console.log('Login failed: Missing credentials')
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await User.findByEmailWithPassword(email)
    if (!user) {
      console.log('Login failed: User not found')
      return res.status(404).json({ message: 'User not found' })
    }

    if (!user.password) {
      return res.status(400).json({
        message: 'This account uses Google or Facebook sign-in. Use those buttons below, or "Forgot password?" to set a password.',
      })
    }

    const isMatch = await User.matchPassword(user, password)
    if (!isMatch) {
      console.log('Login failed: Invalid password')
      return res.status(401).json({ message: 'Invalid password' })
    }

    console.log('Login successful:', user._id)
    res.json({
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, mobile: user.mobile },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: 'Server error. Please try again later.' })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findByEmail(email)
    if (!user) return res.status(404).json({ message: 'No account found with this email' })

    const token = crypto.randomBytes(32).toString('hex')
    await User.setResetToken(user._id, token, new Date(Date.now() + 60 * 60 * 1000))

    sendMail({
      from: `"CharDham Yatra 🕉️" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;background:#18181b;color:#fff;border-radius:16px;padding:32px;">
          <h1 style="color:#f97316;text-align:center;">🕉️ CharDhamYatra</h1>
          <h2 style="text-align:center;">Password Reset</h2>
          <p style="color:#a1a1aa;">Hi ${user.name}, use the token below to reset your password. It expires in <strong>1 hour</strong>.</p>
          <div style="background:#27272a;border-radius:12px;padding:16px;text-align:center;margin:24px 0;">
            <code style="color:#f97316;font-size:14px;word-break:break-all;">${token}</code>
          </div>
          <p style="color:#71717a;font-size:12px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    })

    res.json({ message: 'Reset email sent' })
  } catch (err) {
    console.error('Forgot password error:', err.message)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token) return res.status(400).json({ message: 'Invalid or expired token' })
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const user = await User.findByValidResetToken(token)
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' })

    await User.resetPassword(user._id, password)

    res.json({ message: 'Password reset successful' })
  } catch (err) {
    console.error('Reset password error:', err.message)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
})

// GET /api/auth/social-config: which "Continue with Google / Facebook" buttons the website shows
router.get('/social-config', (req, res) => {
  res.json(socialConfig())
})

// Signs in (or signs up) with a verified Google / Facebook profile.
const socialSignIn = (provider, verify, tokenField) => async (req, res) => {
  try {
    const profile = await verify(req.body?.[tokenField])
    const { user, created } = await User.findOrCreateSocial(provider, profile)
    if (created) sendWelcomeEmail(user.name, user.email)
    res.status(created ? 201 : 200).json(authResponse(user))
  } catch (err) {
    if (err instanceof SocialAuthError) return res.status(err.status).json({ message: err.message })
    if (err.code === '23505') {
      return res.status(409).json({
        message: 'This email is already linked to a different account. Please log in with your email and password.',
      })
    }
    console.error(`${provider} sign-in error:`, err)
    res.status(500).json({ message: 'Something went wrong. Please try again.' })
  }
}

// POST /api/auth/google  { credential }   (from the Google button)
router.post('/google', socialSignIn('google', verifyGoogle, 'credential'))

// POST /api/auth/facebook  { accessToken }   (from the Facebook login popup)
router.post('/facebook', socialSignIn('facebook', verifyFacebook, 'accessToken'))

module.exports = router
