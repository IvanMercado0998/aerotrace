import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'

// True only when actually running inside v0's preview iframe (cross-origin
// embed). False for a normal local `next dev` on http://localhost, even
// though NODE_ENV is 'development' in both cases.
const isV0Preview = !!process.env.V0_RUNTIME_URL

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // Only force cross-site cookie attributes when we're actually embedded in
  // v0's cross-origin preview iframe. A plain local `next dev` server on
  // http://localhost must NOT get `secure: true` — browsers silently refuse
  // to store Secure cookies set over plain HTTP, which is exactly what was
  // causing every server action to see no session and throw "Unauthorized".
  ...(isV0Preview
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})