import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, Lock, Loader2, Mail } from 'lucide-react'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS, AUTH_LINK_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

const CONFIRMATION_COOLDOWN_SECONDS = 60

function getPasswordStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { label: 'Weak', width: '33%', bar: 'bg-severity-high', text: 'text-severity-high' }
  if (score <= 2) return { label: 'Medium', width: '66%', bar: 'bg-severity-medium', text: 'text-severity-medium' }
  return { label: 'Strong', width: '100%', bar: 'bg-severity-low', text: 'text-severity-low' }
}

function getRetrySeconds(error) {
  const match = error?.message?.match(/after\s+(\d+)\s+seconds?/i)
  return match ? Math.max(Number(match[1]), CONFIRMATION_COOLDOWN_SECONDS) : CONFIRMATION_COOLDOWN_SECONDS
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [resendStatus, setResendStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const strength = password ? getPasswordStrength(password) : null
  const secondsRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  useEffect(() => {
    if (!cooldownUntil || secondsRemaining === 0) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [cooldownUntil, secondsRemaining])

  const startCooldown = (seconds = CONFIRMATION_COOLDOWN_SECONDS) => {
    setNow(Date.now())
    setCooldownUntil(Date.now() + seconds * 1_000)
  }

  const emailRedirectTo = `${window.location.origin}/login?confirmed=1`

  const handleRegister = async () => {
    setError(null)
    setResendStatus(null)
    setLoading(true)

    try {
      if (!supabase) throw new Error('Supabase is not configured. Check the dashboard environment variables.')

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (data?.session) {
        return
      }

      // Keep this generic so the UI does not disclose whether an email is already registered.
      setConfirmationPending(true)
      startCooldown()
    } catch (authError) {
      setError(authError.message || 'Unable to create the account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!supabase || secondsRemaining > 0) return

    setError(null)
    setResendStatus(null)
    setResending(true)

    try {
      const { error: authError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      })

      if (authError) {
        startCooldown(getRetrySeconds(authError))
        setError(authError.status === 429
          ? 'Please wait before requesting another confirmation email.'
          : authError.message)
        return
      }

      startCooldown()
      setResendStatus('A new confirmation email was sent. Check your inbox and spam folder.')
    } catch (authError) {
      setError(authError.message || 'Unable to resend the confirmation email.')
    } finally {
      setResending(false)
    }
  }

  if (confirmationPending) {
    return (
      <AuthLayout eyebrow="One More Step" subtitle="Confirm your email to activate ThreatScope">
        <div className="text-center">
          <CheckCircle2 size={34} className="mx-auto mb-4 text-severity-low" aria-hidden="true" />
          <p className="text-sm leading-6 text-ink-muted">
            We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
            Open it once, then return here to sign in.
          </p>

          {error && (
            <div className="mt-5 rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-left text-[13px] text-severity-high" role="alert">
              {error}
            </div>
          )}

          {resendStatus && (
            <div className="mt-5 rounded-md border border-severity-low/25 bg-severity-low/10 px-3 py-2.5 text-left text-[13px] text-severity-low" role="status">
              {resendStatus}
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            disabled={resending || secondsRemaining > 0}
            onClick={handleResend}
            className="mt-6 w-full"
          >
            {resending
              ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
              : secondsRemaining > 0
                ? `Resend available in ${secondsRemaining}s`
                : 'Resend confirmation email'}
          </Button>

          <p className="mt-5 text-sm text-ink-muted">
            Already confirmed? <Link to="/login" className={AUTH_LINK_CLASS}>Login</Link>
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="Get Started" subtitle="Create your account">
      <form onSubmit={event => { event.preventDefault(); handleRegister() }}>
        <div className="mb-4">
          <label htmlFor="register-email" className="mb-1.5 block text-[13px] text-ink-muted">Email</label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input id="register-email" type="email" autoComplete="email" autoFocus required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className={`${AUTH_INPUT_CLASS} pl-9 pr-3`} />
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="register-password" className="mb-1.5 block text-[13px] text-ink-muted">Password</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength="8" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" className={`${AUTH_INPUT_CLASS} pl-9 pr-12`} />
            <button type="button" onClick={() => setShowPassword(visible => !visible)} className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-ink-faint transition-colors duration-150 ease-swift hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {strength && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]"><div className={`h-full transition-all duration-300 ease-swift ${strength.bar}`} style={{ width: strength.width }} /></div>
              <span className={`font-mono text-[11px] ${strength.text}`}>{strength.label}</span>
            </div>
          )}
        </div>

        {error && <div className="mb-4 animate-shake rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high" role="alert">{error}</div>}

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">Already have an account? <Link to="/login" className={AUTH_LINK_CLASS}>Login</Link></p>
    </AuthLayout>
  )
}
