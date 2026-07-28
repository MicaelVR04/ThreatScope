import { useState, useCallback, useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import AlertHistory from './pages/AlertHistory'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import SensorSetupGuide from './pages/SensorSetupGuide'
import SensorManagement from './pages/SensorManagement'
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
    // Google puts OAuth failures (user cancelled, denied consent, etc.) in
    // the redirect URL's hash as `error`/`error_description` rather than
    // ever creating a session — read that here, before supabase-js's own
    // detectSessionInUrl consumes the hash, and forward it to /login as a
    // query param so Login can show a real message instead of the user
    // just silently landing back on the login screen with no explanation.
    if (window.location.hash.includes('error=')) {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const description = params.get('error_description') || params.get('error')
      if (description) {
        window.history.replaceState(null, '', window.location.pathname)
        navigate(`/login?oauth_error=${encodeURIComponent(description.replace(/\+/g, ' '))}`, { replace: true })
      }
    }

    // Supabase only honors a signInWithOAuth/resetPasswordForEmail
    // `redirectTo` if that exact URL is in the project's Redirect URLs
    // allow-list — otherwise it silently falls back to the configured Site
    // URL (often just the app root) while still attaching the real session
    // to the hash. Rather than depend on that allow-list being configured
    // correctly, capture where we SHOULD end up from the hash's own `type`
    // now — a password-recovery link still needs /reset-password to set a
    // new password; anything else (a completed Google sign-in) belongs on
    // /dashboard. Crucially, don't navigate yet: calling navigate() with a
    // plain path string clears the URL's hash immediately (react-router
    // resets it to empty), which would erase the access_token before
    // supabase-js's own async hash detection ever reads it. Wait until
    // getSession() below actually resolves with a real session first.
    let postAuthRedirect = null
    if (window.location.hash.includes('access_token=') && window.location.pathname !== '/reset-password') {
      const params = new URLSearchParams(window.location.hash.slice(1))
      postAuthRedirect = params.get('type') === 'recovery' ? '/reset-password' : '/dashboard'
    }

    if (!supabase) {
      setSession(null)
      return undefined
    }

    // Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
      if (session && postAuthRedirect) navigate(postAuthRedirect, { replace: true })
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
          <Route path="/sensor-setup" element={<SensorSetupGuide />} />
          <Route path="/login" element={<PublicOnlyRoute session={session}><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute session={session}><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute session={session}><ForgotPassword /></PublicOnlyRoute>} />
          <Route
            path="/reset-password"
            element={
              <ProtectedRoute session={session}>
                <ResetPassword />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/sensors"
            element={
              <ProtectedRoute session={session}>
                <Navbar
                  connected={connected}
                  userEmail={session?.user?.email}
                  signingOut={signingOut}
                  onLogout={handleLogout}
                />
                <SensorManagement />
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
