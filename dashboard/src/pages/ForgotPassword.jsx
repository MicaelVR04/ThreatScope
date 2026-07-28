import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS, AUTH_LINK_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      if (!supabase) throw new Error('Supabase is not configured. Check the dashboard environment variables.')

      // resetPasswordForEmail always resolves without revealing whether the
      // address is registered — same enumeration-safe pattern as signUp, so
      // this screen shows one generic message regardless of the outcome.
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (authError && authError.status !== 429) throw authError
    } catch (authError) {
      setError(authError.message || 'Unable to send a reset link. Please try again.')
      return
    } finally {
      setLoading(false)
    }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout eyebrow="Check Your Inbox" subtitle="Password reset requested">
        <div className="text-center">
          <CheckCircle2 size={34} className="mx-auto mb-4 text-severity-low" aria-hidden="true" />
          <p className="text-sm leading-6 text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, a password reset
            link is on its way. Open it, then set a new password.
          </p>
          <p className="mt-5 text-sm text-ink-muted">
            <Link to="/login" className={AUTH_LINK_CLASS}>Back to login</Link>
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="Reset Access" subtitle="We'll email you a reset link">
      <form onSubmit={event => { event.preventDefault(); handleSubmit() }}>
        <div className="mb-6">
          <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] text-ink-muted">Email</label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
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
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        <Link to="/login" className={AUTH_LINK_CLASS}>Back to login</Link>
      </p>
    </AuthLayout>
  )
}
