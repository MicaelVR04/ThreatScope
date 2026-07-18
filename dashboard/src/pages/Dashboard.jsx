import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Activity, AlertTriangle, PauseCircle, PlayCircle } from 'lucide-react'
import Button from '../components/theme/Button'
import StatusBadge from '../components/theme/StatusBadge'
import AlertCard from '../components/AlertCard'
import SeverityChart from '../components/SeverityChart'
import AttackTypeChart from '../components/AttackTypeChart'
import useWebSocket from '../hooks/useWebSocket'
import {
  analyzeRecentAlerts,
  getAlertStats,
  getAlertsSummary,
  getAttackTypeStats,
  getScanStatus,
  runScanNow,
  setScanSchedule,
} from '../services/api'

// Hex-only — feeds the Recharts gradient/Area loop below, which needs
// literal color values (Recharts renders its own SVG, it doesn't consume
// Tailwind classes). Values match the severity design-system tokens exactly.
const SEV_COLOR = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }

// Section-label eyebrow style, reused identically across every section below
// — matches the design system's documented eyebrow pattern (font-mono,
// uppercase, tracked, muted).
const SECTION_TITLE = 'mb-3 font-mono text-sm font-semibold uppercase tracking-[0.8px] text-ink-muted'

const FEED_LIMIT = 20

function formatChartData(rawData) {
  const buckets = {}
  rawData.forEach(({ timestamp, severity }) => {
    const time = new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
    if (!buckets[time]) buckets[time] = { timestamp: time, HIGH: 0, MEDIUM: 0, LOW: 0 }
    buckets[time][severity] = (buckets[time][severity] || 0) + 1
  })
  return Object.values(buckets)
}

export default function Dashboard({ onConnectionChange }) {
  const { alerts: wsAlerts, connected } = useWebSocket()
  const [summary,    setSummary]    = useState({ total: 0, high: 0, medium: 0, low: 0 })
  const [chartData,  setChartData]  = useState([])
  const [typeStats,  setTypeStats]  = useState([])
  const [paused,     setPaused]     = useState(false)
  const [aiResult,   setAiResult]   = useState(null)
  const [aiError,    setAiError]    = useState(null)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [scanStatus, setScanStatus] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const frozenRef = useRef([])

  const refreshDashboardData = useCallback(async () => {
    try {
      const [nextSummary, nextChartData, nextTypeStats] = await Promise.all([
        getAlertsSummary(),
        getAlertStats(),
        getAttackTypeStats(),
      ])
      setSummary(nextSummary)
      setChartData(formatChartData(nextChartData))
      setTypeStats(nextTypeStats)
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => { onConnectionChange?.(connected) }, [connected, onConnectionChange])

  useEffect(() => {
    refreshDashboardData()
  }, [refreshDashboardData])

  const refreshScanStatus = useCallback(async () => {
    try {
      setScanStatus(await getScanStatus())
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    refreshScanStatus()
    const id = setInterval(refreshScanStatus, 5000)
    return () => clearInterval(id)
  }, [refreshScanStatus])

  useEffect(() => {
    if (wsAlerts.length > 0) {
      refreshDashboardData()
    }
  }, [wsAlerts.length, refreshDashboardData])

  const handleAnalyzeAlerts = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await analyzeRecentAlerts()
      setAiResult(result)
    } catch (error) {
      console.error(error)
      setAiError(error.message || 'Ollama is not available. Start Ollama and pull the configured model.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleRunScan = async () => {
    setScanLoading(true)
    try {
      setScanStatus(await runScanNow())
    } catch (error) {
      console.error(error)
    } finally {
      setScanLoading(false)
    }
  }

  const handleSchedule = async (enabled, intervalMinutes = scanStatus?.interval_minutes || 5) => {
    setScanLoading(true)
    try {
      setScanStatus(await setScanSchedule(enabled, intervalMinutes))
    } catch (error) {
      console.error(error)
    } finally {
      setScanLoading(false)
    }
  }

  const displayAlerts = paused ? frozenRef.current : wsAlerts.slice(0, FEED_LIMIT)
  if (!paused) frozenRef.current = displayAlerts

  const CHIPS = [
    { label: 'Total',  value: summary.total,  tone: 'text-signal' },
    { label: 'High',   value: summary.high,   tone: 'text-severity-high' },
    { label: 'Medium', value: summary.medium, tone: 'text-severity-medium' },
    { label: 'Low',    value: summary.low,    tone: 'text-severity-low' },
  ]

  const scanState = mapScanState(scanStatus, summary)

  return (
    <main className="px-8 py-6">

      {/* Scan status */}
      <div className="relative mb-6 animate-fade-up" style={{ animationDelay: '0ms' }}>
        <div aria-hidden="true" className={`absolute -inset-6 -z-10 rounded-[32px] blur-3xl ${scanGlowClass(scanState)}`} />
        <section className={`rounded-lg border p-5 ${scanToneClass(scanState)}`}>
          <div className="flex flex-wrap items-start justify-between gap-[18px]">
            <div>
              <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[1px] text-ink-faint">Scan Status</p>
              <div className="mb-1.5 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-[22px] font-bold text-ink">{scanHeadline(scanStatus, summary)}</h1>
                <StatusBadge status={scanState} />
              </div>
              <p className="max-w-[760px] text-sm leading-[1.55] text-ink-muted">{scanMessage(scanStatus, summary)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CHIPS.map(({ label, value, tone }) => (
                  <span key={label} className="inline-flex items-baseline gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-ink-muted">
                    {label} <b className={`font-mono text-sm ${tone}`}>{value}</b>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleRunScan} disabled={scanLoading || scanStatus?.state === 'running'}>
                {scanStatus?.state === 'running' ? 'Scan running...' : 'Run scan now'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleSchedule(true, 5)} disabled={scanLoading}>
                Every 5 min
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleSchedule(true, 10)} disabled={scanLoading}>
                Every 10 min
              </Button>
              {scanStatus?.enabled && (
                <Button variant="danger" size="sm" onClick={() => handleSchedule(false, scanStatus.interval_minutes)} disabled={scanLoading}>
                  Stop schedule
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-muted">
            <span>Scheduled scans: {scanStatus?.enabled ? `on every ${scanStatus.interval_minutes} minutes` : 'off'}</span>
            {scanStatus?.next_scan_at && <span>Next scan: {new Date(scanStatus.next_scan_at).toLocaleTimeString()}</span>}
            {scanStatus?.last_finished_at && <span>Last finished: {new Date(scanStatus.last_finished_at).toLocaleTimeString()}</span>}
          </div>
        </section>
      </div>

      {/* Charts + AI analysis (left) / live feed (right, sticky) */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">

          {/* Charts row */}
          <div className="mb-8 flex flex-wrap animate-fade-up gap-4" style={{ animationDelay: '40ms' }}>
            <section className="min-w-[260px] flex-1 rounded-lg bg-surface px-6 py-5">
              <h2 className={SECTION_TITLE}>Severity Breakdown</h2>
              <SeverityChart data={summary} />
            </section>
            <section className="min-w-[260px] flex-[2] rounded-lg bg-surface px-6 py-5">
              <h2 className={SECTION_TITLE}>Attack Types</h2>
              <AttackTypeChart data={typeStats} />
            </section>
          </div>

          {/* Time-series area chart */}
          <section className="mb-8 animate-fade-up" style={{ animationDelay: '80ms' }}>
            <h2 className={SECTION_TITLE}>Alert Activity Over Time</h2>
            {chartData.length === 0 ? (
              <p className="italic text-ink-faint">No stats data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {Object.entries(SEV_COLOR).map(([k, color]) => (
                      <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="timestamp" stroke="#8B96A5" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8B96A5" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0D131B', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6 }}
                    labelStyle={{ color: '#8B96A5', fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#8B96A5' }} />
                  {Object.entries(SEV_COLOR).map(([k, color]) => (
                    <Area
                      key={k} type="monotone" dataKey={k}
                      stroke={color} strokeWidth={2}
                      fill={`url(#grad-${k})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* AI developer diagnostics */}
          <section className="mb-8 animate-fade-up rounded-lg border border-white/[0.08] bg-surface px-6 py-5 lg:mb-0" style={{ animationDelay: '120ms' }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={SECTION_TITLE}>AI Analysis</h2>
                <p className="-mt-1 text-[13px] text-ink-faint">Developer diagnostics from local Ollama. Rule detections stay authoritative.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleAnalyzeAlerts} disabled={aiLoading}>
                <Activity size={14} />
                {aiLoading ? 'Analyzing...' : 'Analyze recent alerts'}
              </Button>
            </div>

            {aiError && (
              <div className="flex items-center gap-2 rounded-md border border-severity-high/25 bg-severity-high/10 px-3 py-2.5 text-[13px] text-severity-high">
                <AlertTriangle size={16} />
                <span>{aiError}</span>
              </div>
            )}

            {!aiError && !aiResult && (
              <p className="italic text-sm text-ink-faint">Run analysis after alerts appear in the dashboard.</p>
            )}

            {aiResult && (
              <div className="flex flex-col gap-2.5">
                <div className="mb-0.5 flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full border border-white/[0.12] px-[9px] py-1 text-xs text-ink-muted">Model: {aiResult.model}</span>
                  <span className="rounded-full border border-white/[0.12] px-[9px] py-1 text-xs text-ink-muted">{aiResult.alert_count} alerts analyzed</span>
                  <span className={`rounded-full border px-[9px] py-1 text-xs font-extrabold ${riskClass(aiResult.risk_level)}`}>{aiResult.risk_level}</span>
                </div>
                <p className="text-sm leading-[1.55] text-ink-muted"><strong>Summary:</strong> {aiResult.summary}</p>
                <p className="text-sm leading-[1.55] text-ink-muted"><strong>Pattern:</strong> {aiResult.pattern}</p>
                <p className="text-sm leading-[1.55] text-ink-muted"><strong>Demo note:</strong> {aiResult.demo_note}</p>
                {aiResult.rule_tuning_suggestions?.length > 0 && (
                  <div>
                    <p className="mb-1.5 mt-1 font-mono text-xs uppercase tracking-[0.8px] text-ink-muted">Rule tuning suggestions</p>
                    <ul className="list-inside list-disc pl-5 text-sm leading-[1.55] text-ink-muted">
                      {aiResult.rule_tuning_suggestions.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-0.5 text-xs text-ink-faint">{aiResult.disclaimer}</p>
              </div>
            )}
          </section>
        </div>

        {/* Live alert feed — sticky on desktop so it stays visible while the
            left column (charts/AI analysis) scrolls; stacks normally below
            on narrow viewports, where a fixed sidebar wouldn't fit. */}
        <aside className="w-full shrink-0 animate-fade-up lg:sticky lg:top-6 lg:w-[320px]" style={{ animationDelay: '160ms' }}>
          <section className="rounded-lg border border-white/[0.08] bg-surface px-5 py-5 lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto">
            <div className="mb-3 flex items-center gap-3">
              <h2 className={SECTION_TITLE}>Live Alert Feed</h2>
              <span className="flex-1 text-xs text-ink-faint">{wsAlerts.length} received</span>
              <Button variant="ghost" size="sm" onClick={() => setPaused(p => !p)}>
                {paused
                  ? <><PlayCircle  size={14} /> Resume</>
                  : <><PauseCircle size={14} /> Pause</>}
              </Button>
            </div>
            {displayAlerts.length === 0
              ? <p className="italic text-ink-faint">No alerts detected yet. Listening...</p>
              : displayAlerts.map((alert, i) => <AlertCard key={alert.id ?? i} alert={alert} />)
            }
          </section>
        </aside>
      </div>

    </main>
  )
}

function riskClass(riskLevel) {
  if (riskLevel === 'HIGH') return 'border-severity-high/25 text-severity-high'
  if (riskLevel === 'LOW') return 'border-severity-low/25 text-severity-low'
  return 'border-severity-medium/25 text-severity-medium'
}

function scanHeadline(scanStatus, summary) {
  if (scanStatus?.state === 'running') return 'Scan started'
  if (scanStatus?.state === 'threats_found') return 'Threats detected'
  if (scanStatus?.state === 'secure' || summary.total === 0) return 'Network is secure'
  return 'Network monitoring active'
}

function scanMessage(scanStatus, summary) {
  if (scanStatus?.state === 'running') {
    return 'ThreatScope is checking recent network activity. New alerts will appear below if suspicious traffic is found.'
  }
  if (scanStatus?.state === 'threats_found') return scanStatus.message
  if (scanStatus?.state === 'secure' || summary.total === 0) {
    return 'No threats were detected in the latest scan window. Keep scheduled scans on for continuous checks.'
  }
  return 'Alerts below explain suspicious behavior in plain English so non-technical users can understand what happened.'
}

// Same 4 states StatusBadge exposes (scanning/alert/secure/monitoring),
// derived from the exact same conditions scanHeadline/scanMessage already
// check — kept as one shared mapper so the badge and the panel's own
// border/background tone can't drift out of sync with each other.
function mapScanState(scanStatus, summary) {
  if (scanStatus?.state === 'running') return 'scanning'
  if (scanStatus?.state === 'threats_found') return 'alert'
  if (scanStatus?.state === 'secure' || summary.total === 0) return 'secure'
  return 'monitoring'
}

function scanToneClass(state) {
  if (state === 'alert') return 'border-severity-high/30 bg-severity-high/10'
  if (state === 'scanning') return 'border-signal/30 bg-signal-dim'
  if (state === 'secure') return 'border-severity-low/30 bg-severity-low/10'
  return 'border-white/[0.12] bg-surface'
}

// Ambient glow behind the scan panel — same state derivation as
// scanToneClass so the halo can never drift out of sync with the panel's
// own border/background tone. Active states (alert/scanning) pulse faster
// and brighter than the calm idle states (secure/monitoring), so the
// motion itself reads as "something is happening" vs. "all quiet."
function scanGlowClass(state) {
  if (state === 'alert') return 'bg-severity-high/25 animate-pulse'
  if (state === 'scanning') return 'bg-signal/20 animate-pulse'
  if (state === 'secure') return 'bg-severity-low/15 animate-pulse-slow'
  return 'bg-white/[0.05] animate-pulse-slow'
}
