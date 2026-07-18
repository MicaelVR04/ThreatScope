import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/theme/Button'
import AuthLayout, { AUTH_INPUT_CLASS } from '../components/AuthLayout'
import { supabase } from '../supabaseClient'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
      <div className="mb-4">
        <label className="mb-1.5 block text-[13px] text-ink-muted">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={AUTH_INPUT_CLASS}
        />
      </div>

      <div className="mb-6">
        <label className="mb-1.5 block text-[13px] text-ink-muted">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className={AUTH_INPUT_CLASS}
        />
      </div>

      {error && (
        <div className="mb-4 animate-fade-up rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 animate-fade-up rounded-md border border-severity-low/25 bg-severity-low/10 px-3 py-2.5 text-[13px] text-severity-low">
          {success}
        </div>
      )}

      <Button variant="primary" onClick={handleRegister} disabled={loading} className="w-full">
        {loading ? 'Registering…' : 'Register'}
      </Button>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-signal hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  )
}
