import { NavLink } from 'react-router-dom'
import { Shield, LayoutDashboard, Clock, Wifi, WifiOff, LogOut } from 'lucide-react'

export default function Navbar({ connected, userEmail, signingOut, onLogout }) {
  return (
    <header style={styles.nav}>
      <div style={styles.brand}>
        <div style={styles.logoMark} aria-hidden="true">
          <Shield size={18} color="#f8fafc" strokeWidth={2.4} />
        </div>
        <div>
          <span style={styles.title}>ThreatScope</span>
          <span style={styles.subtitle}>NIDS Console</span>
        </div>
      </div>

      <nav style={styles.links}>
        <NavLink to="/" end style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
          <LayoutDashboard size={15} />
          Dashboard
        </NavLink>
        <NavLink to="/history" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
          <Clock size={15} />
          Alert History
        </NavLink>
      </nav>

      <div style={styles.actions}>
        <div style={{ ...styles.statusWrap, borderColor: connected ? '#22c55e40' : '#ef444440' }}>
          {connected ? (
            <>
              <span style={styles.pulse} />
              <Wifi size={13} color="#22c55e" />
              <span style={{ ...styles.statusText, color: '#22c55e' }}>LIVE</span>
            </>
          ) : (
            <>
              <WifiOff size={13} color="#ef4444" />
              <span style={{ ...styles.statusText, color: '#ef4444' }}>DISCONNECTED</span>
            </>
          )}
        </div>

        {userEmail && (
          <span className="ts-user-email" style={styles.userEmail} title={userEmail}>
            {userEmail}
          </span>
        )}

        <button
          type="button"
          style={{ ...styles.logoutBtn, ...(signingOut ? styles.logoutBtnDisabled : {}) }}
          onClick={onLogout}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />
          <span className="ts-logout-text" style={styles.logoutText}>{signingOut ? 'Signing out' : 'Logout'}</span>
        </button>
      </div>

      <style>{`
        @keyframes ts-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }

        @media (max-width: 760px) {
          .ts-logout-text,
          .ts-user-email {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}

const styles = {
  nav:        { display: 'flex', alignItems: 'center', gap: 24, padding: '14px 32px', borderBottom: '1px solid #1e293b', background: '#0f172a' },
  brand:      { display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 },
  logoMark:   { width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #6366f1, #14b8a6)', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 22px rgba(20,184,166,0.16)' },
  title:      { display: 'block', fontSize: 17, fontWeight: 'bold', color: '#f1f5f9', letterSpacing: 0 },
  subtitle:   { display: 'block', marginTop: 1, fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, textTransform: 'uppercase' },
  links:      { display: 'flex', gap: 20, flex: 1, marginLeft: 12 },
  link:       { display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 14, padding: '4px 0' },
  active:     { color: '#818cf8', fontWeight: 600 },
  actions:    { display: 'flex', alignItems: 'center', gap: 12 },
  statusWrap: { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid', borderRadius: 99, padding: '4px 12px' },
  statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
  userEmail:  { maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: 12 },
  logoutBtn:  { display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', background: '#111827', color: '#cbd5e1', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  logoutBtnDisabled: { opacity: 0.65, cursor: 'not-allowed' },
  logoutText: { lineHeight: 1 },
  pulse:      { width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'ts-pulse 1.4s ease-in-out infinite' },
}
