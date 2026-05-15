import { NavLink } from 'react-router-dom'
import { Shield, Clock } from 'lucide-react'

export default function Navbar({ connected }) {
  return (
    <header style={styles.nav}>
      <div style={styles.brand}>
        <Shield size={22} color="#6366f1" />
        <span style={styles.title}>ThreatScope</span>
      </div>

      <nav style={styles.links}>
        <NavLink to="/" end style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
          Dashboard
        </NavLink>
        <NavLink to="/history" style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.active : {}) })}>
          <Clock size={14} />
          Alert History
        </NavLink>
      </nav>

      <span style={{ ...styles.badge, background: connected ? '#22c55e' : '#ef4444' }}>
        {connected ? 'LIVE' : 'DISCONNECTED'}
      </span>
    </header>
  )
}

const styles = {
  nav:    { display: 'flex', alignItems: 'center', gap: 24, padding: '16px 32px', borderBottom: '1px solid #1e293b', background: '#0f172a' },
  brand:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:  { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9' },
  links:  { display: 'flex', gap: 20, flex: 1, marginLeft: 32 },
  link:   { display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', textDecoration: 'none', fontSize: 14 },
  active: { color: '#6366f1', fontWeight: 600 },
  badge:  { padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 'bold', color: '#fff' },
}
