import { useState, useEffect, useMemo } from 'react'
import Button from '../components/theme/Button'
import AlertTable from '../components/AlertTable'
import { clearMyAlerts, getAlerts } from '../services/api'
import { RefreshCw, Download, Trash2 } from 'lucide-react'
import { threatFriendlyLabel, threatLabel, threatPlainEnglish } from '../utils/threatLabels'

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
  const [clearing,  setClearing] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)

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
        threatLabel(a.type).toLowerCase().includes(q) ||
        threatFriendlyLabel(a.type).toLowerCase().includes(q) ||
        threatPlainEnglish(a.type).toLowerCase().includes(q) ||
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

  async function clearHistory() {
    setClearing(true)
    setError(null)
    try {
      await clearMyAlerts()
      setAlerts([])
      setSearch('')
      setDateFrom('')
      setDateTo('')
      setConfirmingClear(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setClearing(false)
    }
  }

  return (
    <main className="relative px-4 py-5 sm:px-8 sm:py-6">

      {/* Noise texture behind everything on this page, same treatment as
          Landing/AuthLayout/Dashboard. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: `url("${NOISE_DATA_URI}")`, backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }} />

      {/* Toolbar: title, filters, and actions in one row */}
      <div className="relative z-10 mb-5 flex flex-wrap animate-fade-up items-center gap-3" style={{ animationDelay: '0ms' }}>
        <h1 className="font-display text-xl font-bold text-ink">Alert History</h1>

        <input
          className="w-full rounded-md border border-white/[0.12] bg-surface px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint sm:w-[220px]"
          type="text"
          placeholder="Search by type or IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label className="flex w-full items-center gap-2 text-[13px] text-ink-muted sm:w-auto">
          From
          <input
            className="min-w-0 flex-1 rounded-md border border-white/[0.12] bg-surface px-2.5 py-2 text-[13px] text-ink outline-none sm:flex-none"
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
        </label>
        <label className="flex w-full items-center gap-2 text-[13px] text-ink-muted sm:w-auto">
          To
          <input
            className="min-w-0 flex-1 rounded-md border border-white/[0.12] bg-surface px-2.5 py-2 text-[13px] text-ink outline-none sm:flex-none"
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

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Button variant="secondary" size="sm" className="group" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-[ts-spin_1s_linear_infinite]' : 'transition-transform duration-200 ease-swift group-hover:rotate-45'} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" className="group" onClick={exportCSV} title="Export CSV" disabled={!filtered.length}>
            <Download size={14} className="transition-transform duration-200 ease-swift group-hover:translate-y-0.5" /> Export CSV
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmingClear(true)} disabled={!alerts.length || clearing || confirmingClear}>
            <Trash2 size={14} /> {clearing ? 'Clearing...' : 'Clear alert history'}
          </Button>
        </div>

        {confirmingClear && (
          <div
            role="alertdialog"
            aria-labelledby="clear-history-title"
            aria-describedby="clear-history-description"
            className="w-full rounded-md border border-severity-high/30 bg-severity-high/10 p-4"
          >
            <p id="clear-history-title" className="font-display text-sm font-semibold text-ink">Delete all alert history?</p>
            <p id="clear-history-description" className="mt-1 text-xs leading-relaxed text-ink-muted">
              This permanently removes every alert stored for your account. Other users are not affected.
            </p>
            <div className="mt-3 flex flex-col-reverse gap-2 min-[360px]:flex-row min-[360px]:justify-end">
              <Button variant="secondary" size="sm" onClick={() => setConfirmingClear(false)} disabled={clearing}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={clearHistory} disabled={clearing}>
                <Trash2 size={14} /> {clearing ? 'Deleting...' : 'Delete all alerts'}
              </Button>
            </div>
          </div>
        )}
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
