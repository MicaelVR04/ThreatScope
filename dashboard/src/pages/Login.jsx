import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!supabase) {
      navigate('/')
      return
    }
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            color: '#6366f1',
            fontSize: '1.75rem',
            fontWeight: '700',
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            ThreatScope
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '8px', fontSize: '0.875rem' }}>
            Sign in to your account
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '6px' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '6px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{
            color: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '0.875rem',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            backgroundColor: loading ? '#4f46e5' : '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background-color 0.15s',
          }}
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem', color: '#94a3b8' }}>
          Don't have an account?{' '}
          <a
            href="/register"
            style={{
              color: '#6366f1',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            Create an account
          </a>
        </p>
      </div>
    </div>
  )
}
