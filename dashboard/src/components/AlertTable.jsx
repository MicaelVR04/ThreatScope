import SeverityBadge from './SeverityBadge'

const HEADERS = ['Severity', 'Type', 'Source IP', 'Destination IP', 'Timestamp']

export default function AlertTable({ alerts = [] }) {
  if (!alerts.length) {
    return <p style={{ color: '#475569', fontStyle: 'italic' }}>No alerts to display.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {HEADERS.map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, i) => (
            <tr key={alert.id ?? i} style={styles.row}>
              <td style={styles.td}><SeverityBadge severity={alert.severity} /></td>
              <td style={styles.td}>{alert.type}</td>
              <td style={styles.td}>{alert.src_ip}</td>
              <td style={styles.td}>{alert.dst_ip}</td>
              <td style={{ ...styles.td, color: '#475569', fontSize: 12 }}>
                {new Date(alert.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#f1f5f9' },
  th:    { textAlign: 'left', padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid #1e293b', fontWeight: 600 },
  td:    { padding: '10px 14px', borderBottom: '1px solid #1e293b' },
  row:   { background: '#0f172a' },
}
