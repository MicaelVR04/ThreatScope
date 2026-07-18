import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS, AUTH_LINK_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

// Score-based tiers reusing the existing severity tokens (high/medium/low)
// as weak/medium/strong — the same 3-color semantic already established for
// alerts, just applied to a different judgment. `bar`/`text` are full
// literal classes, not built from a variable, for Tailwind's static scanner.
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

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const strength = password ? getPasswordStrength(password) : null

  const handleRegister = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)
    const { data, error: authError } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else if (data?.user && !data.session) {
      setSuccess('Check your email to confirm your account before signing in.')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <AuthLayout eyebrow="Get Started" subtitle="Create your account">
      <form
        onSubmit={e => {
          e.preventDefault()
          handleRegister()
        }}
      >
        <div className="mb-4">
          <label htmlFor="register-email" className="mb-1.5 block text-[13px] text-ink-muted">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="register-email"
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
          <label htmlFor="register-password" className="mb-1.5 block text-[13px] text-ink-muted">
            Password
          </label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${AUTH_INPUT_CLASS} pl-9 pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition-colors duration-150 ease-swift hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {strength && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full transition-all duration-300 ease-swift ${strength.bar}`}
                  style={{ width: strength.width }}
                />
              </div>
              <span className={`font-mono text-[11px] ${strength.text}`}>{strength.label}</span>
            </div>
          )}
        </div>

        {error && (
          <div
            key={error}
            className="mb-4 animate-shake rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 animate-fade-up rounded-md border border-severity-low/25 bg-severity-low/10 px-3 py-2.5 text-[13px] text-severity-low">
            {success}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Registering…' : 'Register'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className={AUTH_LINK_CLASS}>
          Login
        </Link>
      </p>
    </AuthLayout>
  )
}
