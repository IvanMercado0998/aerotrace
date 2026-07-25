import { cookies } from 'next/headers'

const ADMIN_USERNAME = 'AEROTRACE2026'
const ADMIN_PASSWORD = 'AerotraceMonitor!'
const SESSION_COOKIE_NAME = 'aerotrace_admin_session'

// Same reasoning as lib/auth.ts: only v0's preview iframe needs cross-site
// (SameSite=None; Secure) cookies. A local `next dev` on http://localhost
// needs SameSite=Lax and secure:false, since Secure cookies are silently
// dropped by browsers over plain HTTP, and SameSite=None without Secure is
// rejected outright.
const isV0Preview = !!process.env.V0_RUNTIME_URL

export async function validateAdminCredentials(username: string, password: string): Promise<boolean> {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export async function createAdminSession() {
  const cookieStore = await cookies()
  const sessionToken = Buffer.from(`${ADMIN_USERNAME}:${Date.now()}`).toString('base64')

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || isV0Preview,
    sameSite: isV0Preview ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })

  return sessionToken
}

export async function getAdminSession() {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const session = await getAdminSession()
  return !!session
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}