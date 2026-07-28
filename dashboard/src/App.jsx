import { useState, useCallback, useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Button from './components/theme/Button'
import { AUTH_LINK_CLASS } from './components/AuthLayout'
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
        <div className="px-8 py-16 text-center">
          <h2 className="mb-3 font-display text-xl font-semibold text-severity-high">Something went wrong</h2>
          <pre className="mb-6 whitespace-pre-wrap text-[13px] text-ink-muted">{this.state.error.message}</pre>
          <Button variant="primary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── 404 page ─────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="px-8 py-20 text-center">
      <h1 className="m-0 font-display text-6xl font-bold text-ink">404</h1>
      <p className="my-3 text-ink-muted">Page not found</p>
      <Link to="/" className={AUTH_LINK_CLASS}>← Back to home</Link>
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
