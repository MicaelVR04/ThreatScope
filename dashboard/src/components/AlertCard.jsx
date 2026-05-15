import SeverityBadge from './SeverityBadge'
import { AlertTriangle } from 'lucide-react'

export default function AlertCard({ alert }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <AlertTriangle size={16} color="#f59e0b" />
        <SeverityBadge severity={alert.severity} />
        <span style={styles.type}>{alert.type}</span>
      </div>
      <div style={styles.meta}>
        <span>{alert.src_ip} → {alert.dst_ip}</span>
        <span style={styles.time}>{new Date(alert.timestamp).toLocaleString()}</span>
      </div>
    </div>
  )
}

const styles = {
  card:   { background: '#1e293b', borderRadius: 8, padding: '14px 18px', marginBottom: 8 },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  type:   { flex: 1, fontSize: 14, fontWeight: 600, color: '#f1f5f9' },
  meta:   { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8' },
  time:   { color: '#475569', fontSize: 12 },
}
