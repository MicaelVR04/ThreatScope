import SeverityBadge from './SeverityBadge'
import { AlertTriangle, ShieldAlert, Info } from 'lucide-react'
import { threatLabel, threatPlainEnglish } from '../utils/threatLabels'

const SEVERITY_ICON = {
  HIGH:   <ShieldAlert size={16} color="#ef4444" />,
  MEDIUM: <AlertTriangle size={16} color="#f59e0b" />,
  LOW:    <Info size={16} color="#22c55e" />,
}

const BORDER_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }

export default function AlertCard({ alert }) {
  const border = BORDER_COLOR[alert.severity] || '#334155'
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${border}` }}>
      <div style={styles.header}>
        {SEVERITY_ICON[alert.severity] ?? <Info size={16} color="#94a3b8" />}
        <SeverityBadge severity={alert.severity} />
        <span style={styles.type}>{threatLabel(alert.type)}</span>
        <span style={styles.time}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>
      <p style={styles.description}>{threatPlainEnglish(alert.type)}</p>
      <div style={styles.meta}>
        <span style={styles.ip}>{alert.src_ip}</span>
        <span style={styles.arrow}>→</span>
        <span style={styles.ip}>{alert.dst_ip}</span>
        {alert.protocol && <span style={styles.tag}>{alert.protocol}</span>}
        {alert.dst_port && <span style={styles.tag}>:{alert.dst_port}</span>}
      </div>
    </div>
  )
}

const styles = {
  card:   { background: '#1e293b', borderRadius: 8, padding: '12px 16px', marginBottom: 8 },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  type:   { flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9' },
  description: { color: '#94a3b8', fontSize: 12, lineHeight: 1.45, margin: '0 0 8px' },
  meta:   { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' },
  ip:     { fontFamily: 'monospace', color: '#cbd5e1' },
  arrow:  { color: '#475569' },
  tag:    { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#64748b' },
  time:   { color: '#475569', fontSize: 12, marginLeft: 'auto' },
}
