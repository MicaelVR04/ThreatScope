import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS, AUTH_LINK_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      navigate('/dashboard')
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
          <label htmlFor="login-password" className="mb-1.5 block text-[13px] text-ink-muted">
            Password
          </label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              id="login-password"
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
        </div>

        {error && (
          <div className="mb-4 animate-fade-up rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high">
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : 'Login'}
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
