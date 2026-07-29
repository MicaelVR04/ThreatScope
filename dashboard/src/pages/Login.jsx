import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS, AUTH_LINK_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState(null)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const location = useLocation()
  const secondsRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  useEffect(() => {
    if (!cooldownUntil || secondsRemaining === 0) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [cooldownUntil, secondsRemaining])

  const startCooldown = () => {
    setNow(Date.now())
    setCooldownUntil(Date.now() + 60_000)
  }

  const emailRedirectTo = `${window.location.origin}/login?confirmed=1`
  const emailWasConfirmed = new URLSearchParams(location.search).get('confirmed') === '1'
  const oauthError = new URLSearchParams(location.search).get('oauth_error')

  const handleLogin = async () => {
    setError(null)
    setNeedsConfirmation(false)
    setResendStatus(null)
    setLoading(true)
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Check the dashboard environment variables.')
      }

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        if (/email not confirmed/i.test(authError.message)) {
          setNeedsConfirmation(true)
          setError('Confirm your email before signing in.')
        } else {
          setError(authError.message)
        }
      }
    } catch (authError) {
      setError(authError.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setNeedsConfirmation(false)
    setResendStatus(null)
    setGoogleLoading(true)

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Check the dashboard environment variables.')
      }

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      })

      if (authError) throw authError
    } catch (authError) {
      setError(authError.message || 'Unable to start Google sign-in. Please try again.')
      setGoogleLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!supabase || !email || secondsRemaining > 0) return

    setError(null)
    setResendStatus(null)
    setResending(true)
    try {
      const { error: authError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      })

      startCooldown()
      if (authError) {
        setError(authError.status === 429
          ? 'Please wait before requesting another confirmation email.'
          : authError.message)
        return
      }

      setResendStatus('A confirmation email was sent. Check your inbox and spam folder.')
    } catch (authError) {
      startCooldown()
      setError(authError.message || 'Unable to resend the confirmation email.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout eyebrow="Secure Access" subtitle="Sign in to your account">
      <form
        onSubmit={e => {
          e.preventDefault()
          handleLogin()
        }}
      >
        <div className="mb-4">
          <label htmlFor="login-email" className="mb-1.5 block text-[13px] text-ink-muted">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="login-email"
              type="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${AUTH_INPUT_CLASS} pl-9 pr-3`}
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-[13px] text-ink-muted">
              Password
            </label>
            <Link to="/forgot-password" className={`${AUTH_LINK_CLASS} text-[13px]`}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${AUTH_INPUT_CLASS} pl-9 pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-ink-faint transition-colors duration-150 ease-swift hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div
            key={error}
            className="mb-4 animate-shake rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high"
          >
            {error}
          </div>
        )}

        {oauthError && !error && (
          <div className="mb-4 rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high" role="alert">
            Google sign-in didn't complete: {oauthError}
          </div>
        )}

        {emailWasConfirmed && !error && (
          <div className="mb-4 rounded-md border border-severity-low/25 bg-severity-low/10 px-3 py-2.5 text-[13px] text-severity-low" role="status">
            Email confirmed. You can now sign in.
          </div>
        )}

        {needsConfirmation && (
          <div className="mb-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={resending || secondsRemaining > 0 || !email}
              onClick={handleResendConfirmation}
              className="w-full"
            >
              {resending
                ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
                : secondsRemaining > 0
                  ? `Resend available in ${secondsRemaining}s`
                  : 'Resend confirmation email'}
            </Button>
            {resendStatus && <p className="mt-2 text-center text-[13px] text-severity-low" role="status">{resendStatus}</p>}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Signing in…' : 'Login'}
        </Button>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-white/[0.1]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">or</span>
          <div className="h-px flex-1 bg-white/[0.1]" />
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={loading || googleLoading}
          onClick={handleGoogleLogin}
          className="w-full"
        >
          {googleLoading && <Loader2 size={16} className="animate-spin" />}
          {googleLoading ? 'Opening Google…' : 'Continue with Google'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Don't have an account?{' '}
        <Link to="/register" className={AUTH_LINK_CLASS}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
