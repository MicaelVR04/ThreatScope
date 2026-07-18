import { useState, useEffect, useMemo } from 'react'
import Button from '../components/theme/Button'
import AlertTable from '../components/AlertTable'
import { getAlerts } from '../services/api'
import { RefreshCw, Download } from 'lucide-react'

// Same fine film-grain noise as Landing.jsx/AuthLayout.jsx/Dashboard.jsx,
// generated once at module load — not rebuilt, just reused so every page
// shares the exact same texture.
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" />
</svg>`
const NOISE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`

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
    <main className="relative px-8 py-6">

      {/* Noise texture behind everything on this page, same treatment as
          Landing/AuthLayout/Dashboard. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: `url("${NOISE_DATA_URI}")`, backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }} />

      {/* Toolbar: title, filters, and actions in one row */}
      <div className="relative z-10 mb-5 flex flex-wrap animate-fade-up items-center gap-3" style={{ animationDelay: '0ms' }}>
        <h1 className="font-display text-xl font-bold text-ink">Alert History</h1>

        <input
          className="w-[220px] rounded-md border border-white/[0.12] bg-surface px-3 py-[7px] text-[13px] text-ink outline-none placeholder:text-ink-faint"
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

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" className="group" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-[ts-spin_1s_linear_infinite]' : 'transition-transform duration-200 ease-swift group-hover:rotate-45'} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" className="group" onClick={exportCSV} title="Export CSV" disabled={!filtered.length}>
            <Download size={14} className="transition-transform duration-200 ease-swift group-hover:translate-y-0.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 animate-fade-up" style={{ animationDelay: '40ms' }}>
        {loading && <p className="italic text-ink-faint">Loading alerts…</p>}
        {error   && <p className="text-severity-high">Error: {error}</p>}
        {!loading && !error && <AlertTable alerts={filtered} />}
      </div>

      <style>{`
        @keyframes ts-spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  )
}
