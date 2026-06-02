import { useState, useMemo } from 'react'
import SeverityBadge from './SeverityBadge'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

const COLUMNS = [
  { key: 'severity',  label: 'Severity' },
  { key: 'type',      label: 'Type' },
  { key: 'src_ip',    label: 'Source IP' },
  { key: 'dst_ip',    label: 'Destination IP' },
  { key: 'timestamp', label: 'Timestamp' },
]

const SEV_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default function AlertTable({ alerts = [] }) {
  const [sortKey, setSortKey]   = useState('timestamp')
  const [sortDir, setSortDir]   = useState('desc')
  const [filter,  setFilter]    = useState('ALL')

  const filtered = useMemo(() =>
    filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter)
  , [alerts, filter])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey]
    if (sortKey === 'severity') { va = SEV_ORDER[va] ?? 9; vb = SEV_ORDER[vb] ?? 9 }
    if (sortKey === 'timestamp') { va = new Date(va); vb = new Date(vb) }
    if (va < vb) return sortDir === 'asc' ? -1 :  1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  }), [filtered, sortKey, sortDir])

  function handleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} color="#475569" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} color="#6366f1" />
      : <ChevronDown size={12} color="#6366f1" />
  }

  return (
    <div>
      {/* Filter bar */}
      <div style={styles.filterBar}>
        {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
          >
            {f}
          </button>
        ))}
        <span style={styles.count}>{sorted.length} alert{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 ? (
        <p style={{ color: '#475569', fontStyle: 'italic', padding: '16px 0' }}>No alerts to display.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} style={styles.th} onClick={() => handleSort(col.key)}>
                    <span style={styles.thInner}>
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((alert, i) => (
                <tr key={alert.id ?? i} style={styles.row}>
                  <td style={styles.td}><SeverityBadge severity={alert.severity} /></td>
                  <td style={styles.td}>{alert.type}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>{alert.src_ip}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>{alert.dst_ip}</td>
                  <td style={{ ...styles.td, color: '#475569', fontSize: 12 }}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  filterBar:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  filterBtn:    { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '4px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  filterActive: { background: '#6366f1', border: '1px solid #6366f1', color: '#fff' },
  count:        { marginLeft: 'auto', fontSize: 12, color: '#475569' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#f1f5f9' },
  th:           { textAlign: 'left', padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid #1e293b', fontWeight: 600, cursor: 'pointer', userSelect: 'none' },
  thInner:      { display: 'inline-flex', alignItems: 'center', gap: 4 },
  td:           { padding: '10px 14px', borderBottom: '1px solid #1e293b' },
  row:          { background: '#0f172a' },
}
