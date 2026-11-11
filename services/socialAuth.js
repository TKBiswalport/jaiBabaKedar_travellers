const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')

const FACEBOOK_GRAPH = 'https://graph.facebook.com/v27.0'

class SocialAuthError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Which sign-in buttons the website should show. Facebook also needs the secret, to check logins.
function socialConfig() {
  const { GOOGLE_CLIENT_ID, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = process.env
  return {
    googleClientId: GOOGLE_CLIENT_ID || null,
    facebookAppId: FACEBOOK_APP_ID && FACEBOOK_APP_SECRET ? FACEBOOK_APP_ID : null,
  }
}

let googleClient = null

// Checks the credential from the "Continue with Google" button.
// Returns the person's Google profile: { providerId, email, name }.
async function verifyGoogle(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new SocialAuthError(503, 'Google sign-in is not available right now.')
  if (!credential || typeof credential !== 'string') {
    throw new SocialAuthError(400, 'Google sign-in failed. Please try again.')
  }

  googleClient ||= new OAuth2Client(clientId)
  let profile
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId })
    profile = ticket.getPayload()
  } catch (err) {
    console.warn('Google sign-in check failed:', err.message)
    throw new SocialAuthError(401, 'Google sign-in failed. Please try again.')
  }

  if (!profile?.email || !profile.email_verified) {
    throw new SocialAuthError(400, 'Your Google account has no verified email address.')
  }
  return { providerId: profile.sub, email: profile.email, name: profile.name || profile.email.split('@')[0] }
}

async function facebookGraph(path, params) {
  const res = await fetch(`${FACEBOOK_GRAPH}/${path}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(10000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook returned ${res.status}`)
  return data
}

// Checks the access token from the Facebook login popup.
// Returns the person's Facebook profile: { providerId, email, name }.
async function verifyFacebook(accessToken) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) throw new SocialAuthError(503, 'Facebook sign-in is not available right now.')
  if (!accessToken || typeof accessToken !== 'string') {
    throw new SocialAuthError(400, 'Facebook sign-in failed. Please try again.')
  }

  let profile
  try {
    // The token must have been issued to our app, not to some other app the person logged into.
    const { data: check } = await facebookGraph('debug_token', {
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    })
    if (!check?.is_valid || String(check.app_id) !== String(appId)) throw new Error('token is not for this app')

    profile = await facebookGraph('me', {
      fields: 'id,name,email',
      access_token: accessToken,
      appsecret_proof: crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex'),
    })
    if (String(profile.id) !== String(check.user_id)) throw new Error('token belongs to a different person')
  } catch (err) {
    console.warn('Facebook sign-in check failed:', err.message)
    throw new SocialAuthError(401, 'Facebook sign-in failed. Please try again.')
  }

  if (!profile.email) {
    throw new SocialAuthError(
      400,
      'We could not get an email address from Facebook. Please allow email access, or sign up with your email.'
    )
  }
  return { providerId: String(profile.id), email: profile.email, name: profile.name || profile.email.split('@')[0] }
}

module.exports = { SocialAuthError, socialConfig, verifyGoogle, verifyFacebook }
