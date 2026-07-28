import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

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

// Mirrors the signup form's own minimum — Supabase's project-level password
// policy is the actual enforcement point (this is a client-side floor, not a
// substitute for it), but there's no reason to accept here what the signup
// form itself would reject.
function isPasswordStrongEnough(password) {
  return password.length >= 8
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const strength = password ? getPasswordStrength(password) : null

  const handleSubmit = async () => {
    setError(null)

    if (!isPasswordStrongEnough(password)) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured. Check the dashboard environment variables.')

      const { error: authError } = await supabase.auth.updateUser({ password })
      if (authError) throw authError

      setDone(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
    } catch (authError) {
      setError(authError.message || 'Unable to update your password. The reset link may have expired — request a new one.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout eyebrow="All Set" subtitle="Password updated">
        <div className="text-center">
          <CheckCircle2 size={34} className="mx-auto mb-4 text-severity-low" aria-hidden="true" />
          <p className="text-sm leading-6 text-ink-muted">Taking you to your dashboard…</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="Reset Access" subtitle="Choose a new password">
      <form onSubmit={event => { event.preventDefault(); handleSubmit() }}>
        <div className="mb-4">
          <label htmlFor="reset-password" className="mb-1.5 block text-[13px] text-ink-muted">New password</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              required
              minLength="8"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className={`${AUTH_INPUT_CLASS} pl-9 pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(visible => !visible)}
              className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-ink-faint transition-colors duration-150 ease-swift hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
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

        <div className="mb-6">
          <label htmlFor="reset-password-confirm" className="mb-1.5 block text-[13px] text-ink-muted">Confirm password</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="reset-password-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength="8"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
              className={`${AUTH_INPUT_CLASS} pl-9 pr-3`}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 animate-shake rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high" role="alert">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
