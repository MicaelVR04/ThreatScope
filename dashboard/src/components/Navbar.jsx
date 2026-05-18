import { NavLink } from 'react-router-dom'
import { Shield, LayoutDashboard, Clock, Wifi, WifiOff } from 'lucide-react'

export default function Navbar({ connected }) {
  return (
    <header style={styles.nav}>
      <div style={styles.brand}>
        <Shield size={22} color="#6366f1" />
        <span style={styles.title}>ThreatScope</span>
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

      <style>{`
        @keyframes ts-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </header>
  )
}

const styles = {
  nav:        { display: 'flex', alignItems: 'center', gap: 24, padding: '14px 32px', borderBottom: '1px solid #1e293b', background: '#0f172a' },
  brand:      { display: 'flex', alignItems: 'center', gap: 10 },
  title:      { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9', letterSpacing: 0.5 },
  links:      { display: 'flex', gap: 20, flex: 1, marginLeft: 32 },
  link:       { display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', textDecoration: 'none', fontSize: 14, padding: '4px 0' },
  active:     { color: '#818cf8', fontWeight: 600 },
  statusWrap: { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid', borderRadius: 99, padding: '4px 12px' },
  statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
  pulse:      { width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'ts-pulse 1.4s ease-in-out infinite' },
}
