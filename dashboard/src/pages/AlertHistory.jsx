import { useState, useEffect, useMemo } from 'react'
import AlertTable from '../components/AlertTable'
import { getAlerts } from '../services/api'
import { RefreshCw, Download } from 'lucide-react'

export default function AlertHistory() {
  const [alerts,    setAlerts]   = useState([])
  const [loading,   setLoading]  = useState(true)
  const [error,     setError]    = useState(null)
  const [search,    setSearch]   = useState('')
  const [dateFrom,  setDateFrom] = useState('')
  const [dateTo,    setDateTo]   = useState('')

  function load() {
    setLoading(true)
    setError(null)
    getAlerts()
      .then(setAlerts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return alerts.filter(a => {
      const matchSearch = !q ||
        a.type?.toLowerCase().includes(q) ||
        a.src_ip?.includes(q) ||
        a.dst_ip?.includes(q)
      const ts = new Date(a.timestamp)
      const matchFrom = !dateFrom || ts >= new Date(dateFrom)
      const matchTo   = !dateTo   || ts <= new Date(dateTo + 'T23:59:59')
      return matchSearch && matchFrom && matchTo
    })
  }, [alerts, search, dateFrom, dateTo])

  function exportCSV() {
    const headers = ['id', 'severity', 'type', 'src_ip', 'dst_ip', 'timestamp']
    const rows = filtered.map(a => headers.map(h => JSON.stringify(a[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'threatscope-alerts.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main style={styles.main}>

      {/* Header row */}
      <div style={styles.headerRow}>
        <h1 style={styles.heading}>Alert History</h1>
        <button style={styles.iconBtn} onClick={load} title="Refresh" disabled={loading}>
          <RefreshCw size={14} style={{ animation: loading ? 'ts-spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
        <button style={styles.iconBtn} onClick={exportCSV} title="Export CSV" disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          style={styles.input}
          type="text"
          placeholder="Search by type or IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label style={styles.dateLabel}>
          From
          <input style={styles.dateInput} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </label>
        <label style={styles.dateLabel}>
          To
          <input style={styles.dateInput} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </label>
        {(search || dateFrom || dateTo) && (
          <button style={styles.clearBtn} onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {loading && <p style={styles.muted}>Loading alerts…</p>}
      {error   && <p style={styles.error}>Error: {error}</p>}
      {!loading && !error && <AlertTable alerts={filtered} />}

      <style>{`
        @keyframes ts-spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  )
}

const styles = {
  main:       { padding: '24px 32px' },
  headerRow:  { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  heading:    { fontSize: 20, color: '#f1f5f9', flex: 1 },
  iconBtn:    { display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  filters:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  input:      { background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 6, padding: '7px 12px', fontSize: 13, width: 260, outline: 'none' },
  dateLabel:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' },
  dateInput:  { background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none' },
  clearBtn:   { background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' },
  muted:      { color: '#475569', fontStyle: 'italic' },
  error:      { color: '#ef4444' },
}
