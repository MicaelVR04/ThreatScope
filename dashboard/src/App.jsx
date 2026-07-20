import { useState, useCallback, useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import AlertHistory from './pages/AlertHistory'
import Login from './pages/Login'
import Register from './pages/Register'
import Landing from './pages/Landing'
import { supabase } from './supabaseClient'

// ── Scroll to top on every route change ─────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// ── Error boundary (class component — React requires it) ─────────────────────
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={errStyles.wrap}>
          <h2 style={errStyles.title}>Something went wrong</h2>
          <pre style={errStyles.msg}>{this.state.error.message}</pre>
          <button style={errStyles.btn} onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const errStyles = {
  wrap:  { padding: '60px 32px', textAlign: 'center' },
  title: { color: '#ef4444', fontSize: 20, marginBottom: 12 },
  msg:   { color: '#94a3b8', fontSize: 13, marginBottom: 24, whiteSpace: 'pre-wrap' },
  btn:   { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 14, cursor: 'pointer' },
}

// ── 404 page ─────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div style={{ padding: '80px 32px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 64, color: '#1e293b', margin: 0 }}>404</h1>
      <p style={{ color: '#94a3b8', margin: '12px 0 24px' }}>Page not found</p>
      <a href="/" style={{ color: '#6366f1', fontSize: 14 }}>← Back to home</a>
    </div>
  )
}

// ── Protected route wrapper ──────────────────────────────────────────────────
function ProtectedRoute({ session, children }) {
  if (session === undefined) return null // still loading
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ session, children }) {
  if (session) return <Navigate to="/dashboard" replace />
  return children
}

// ── App shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const [connected, setConnected] = useState(false)
  const [session, setSession] = useState(undefined)
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return undefined
    }

    // Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null)
      if (!session && event === 'SIGNED_OUT') navigate('/login', { replace: true })
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  const handleConnectionChange = useCallback((status) => {
    setConnected(status)
  }, [])

  const handleLogout = useCallback(async () => {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    setSigningOut(false)

    if (error) {
      console.error('Logout failed:', error.message)
      return
    }

    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col bg-base font-sans text-ink">
      <ErrorBoundary>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicOnlyRoute session={session}><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute session={session}><Register /></PublicOnlyRoute>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute session={session}>
                <Navbar
                  connected={connected}
                  userEmail={session?.user?.email}
                  signingOut={signingOut}
                  onLogout={handleLogout}
                />
                <Dashboard onConnectionChange={handleConnectionChange} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute session={session}>
                <Navbar
                  connected={connected}
                  userEmail={session?.user?.email}
                  signingOut={signingOut}
                  onLogout={handleLogout}
                />
                <AlertHistory />
              </ProtectedRoute>
            }
          />
          <Route path="/404" element={<NotFound />} />
          <Route path="*"   element={<Navigate to="/404" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
