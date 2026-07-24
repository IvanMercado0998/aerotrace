//components/auth-form.tsx
//DO NOT CHANGE LOGIC CALLS
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

export function AdminLoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const usernameRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An error occurred during login')
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      {/* ambient glow, echoes the landing page's node-network atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-cyan-400/20 blur-[120px]" />
      </div>

      <Card className="glass-card relative w-full max-w-md p-8 rounded-3xl border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(8,47,73,0.6)]">
        <div className="flex items-center justify-center mb-8">
          <div
            className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-2xl font-bold text-slate-900 shadow-[0_8px_24px_-6px_rgba(56,189,248,0.6)]"
            aria-hidden="true"
          >
            ◯
          </div>
        </div>

        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] tracking-wide text-blue-200 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 motion-safe:animate-pulse" aria-hidden="true" />
            Secure Access
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AeroTrace</h1>
          <p className="text-white/60">Pollution Monitoring System</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username" className="text-white font-medium">
              Username
            </Label>
            <Input
              ref={usernameRef}
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
              autoComplete="username"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : undefined}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white font-medium">
                Password
              </Label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-controls="password"
                className="text-xs font-medium text-blue-300 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'login-error' : undefined}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:border-transparent"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p
                id="login-error"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="flex items-start gap-2 text-sm text-red-200 focus:outline-none"
              >
                <span className="h-1.5 w-1.5 mt-1.5 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                {error}
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span
                  className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Logging in…
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <p className="text-xs text-white/40 text-center mt-6">Admin Access Only</p>
      </Card>
    </main>
  )
}
