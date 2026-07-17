import { useState, useEffect, useMemo } from 'react'
import Button from '../components/theme/Button'
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
    <main className="px-8 py-6">

      {/* Header row */}
      <div className="mb-5 flex items-center gap-2.5">
        <h1 className="flex-1 font-display text-xl font-bold text-ink">Alert History</h1>
        <Button variant="secondary" size="sm" onClick={load} title="Refresh" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-[ts-spin_1s_linear_infinite]' : ''} />
          Refresh
        </Button>
        <Button variant="secondary" size="sm" onClick={exportCSV} title="Export CSV" disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="w-[260px] rounded-md border border-white/[0.12] bg-surface px-3 py-[7px] text-[13px] text-ink outline-none placeholder:text-ink-faint"
          type="text"
          placeholder="Search by type or IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          From
          <input
            className="rounded-md border border-white/[0.12] bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          To
          <input
            className="rounded-md border border-white/[0.12] bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none"
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </label>
        {(search || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      {loading && <p className="italic text-ink-faint">Loading alerts…</p>}
      {error   && <p className="text-severity-high">Error: {error}</p>}
      {!loading && !error && <AlertTable alerts={filtered} />}

      <style>{`
        @keyframes ts-spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  )
}
