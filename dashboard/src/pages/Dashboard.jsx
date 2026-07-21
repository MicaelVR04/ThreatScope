import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Activity, AlertTriangle, Loader2, PauseCircle, PlayCircle } from 'lucide-react'
import Button from '../components/theme/Button'
import AlertCard from '../components/AlertCard'
import AttackTypeChart from '../components/AttackTypeChart'
import NetworkPulse from '../components/NetworkPulse'
import useWebSocket from '../hooks/useWebSocket'
import {
  analyzeRecentAlerts,
  getApiHealth,
  getAlertStats,
  getAlertsSummary,
  getAttackTypeStats,
  getScanStatus,
  runScanNow,
  setScanSchedule,
  setSensorMonitoring,
} from '../services/api'

// Same fine film-grain noise as Landing.jsx/AuthLayout.jsx, generated once at
// module load — not rebuilt, just reused so every page shares the exact same
// texture.
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" />
</svg>`
const NOISE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`

// Panel heading style shared by Attack Surface / Attack Types / Live Network
// Pulse / AI Analysis — sans (not mono), 13px, tracked .05em, matching the
// mock's `.panel h2` exactly.
const PANEL_H2 = 'mb-1 text-[13px] font-semibold uppercase leading-[normal] tracking-[0.05em] text-ink-muted'
const PANEL_HINT = 'mb-4 text-[11px] leading-[normal] text-ink-faint'

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

// Compact real-data sparkline for the hero — sums each bucket's severities
// into one "event volume" line rather than pulling in fake motion, so the
// hero stays honest about what it's showing.
function sparkPoints(chartData, width = 200, height = 32) {
  if (chartData.length === 0) return `0,${height} ${width},${height}`
  const totals = chartData.map(d => (d.HIGH || 0) + (d.MEDIUM || 0) + (d.LOW || 0))
  const max = Math.max(1, ...totals)
  const step = width / Math.max(1, totals.length - 1)
  return totals.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ')
}

function heatPct(count, total) {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

// Occasional detection blips inside the hero rings — same `radar-ping`
// keyframe and polar-coordinate placement as the landing page's Hero radar,
// but untimed here (there's no rotating sweep on this calmer ring motif to
// sync to), so each dot just gets its own offset into the 6s cycle for a
// staggered, non-uniform blink pattern rather than all firing at once.
const RADAR_DOTS = [
  { angle: 15, radius: 0.32, delay: 0 },
  { angle: 100, radius: 0.48, delay: -2.1 },
  { angle: 190, radius: 0.28, delay: -4.4 },
  { angle: 260, radius: 0.42, delay: -1.2 },
  { angle: 330, radius: 0.2, delay: -3.6 },
]

function radarDotStyle({ angle, radius, delay }) {
  const rad = (angle * Math.PI) / 180
  return {
    left: `${50 + radius * 50 * Math.sin(rad)}%`,
    top: `${50 - radius * 50 * Math.cos(rad)}%`,
    animationDelay: `${delay}s`,
  }
}

// Smoothly counts from the previous value to the next over `duration`ms,
// instead of snapping — same idea as the mock's count-up stat strip. Called
// a fixed number of times per render (once per stat), never inside a loop,
// so it stays rules-of-hooks safe.
function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return
    const start = performance.now()
    let frame
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (p < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        prevRef.current = to
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return display
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
  const [scanError, setScanError] = useState(null)
  const [apiOnline, setApiOnline] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const frozenRef = useRef([])
  const leftColRef = useRef(null)
  const [feedHeight, setFeedHeight] = useState(null)

  // Same technique as Hero's headlineIn: a boolean flipped post-mount drives
  // a sequence of per-element transitionDelays below, so the scan panel
  // reveals piece by piece instead of fading in as one flat block.
  useEffect(() => { setRevealed(true) }, [])

  // Measures the left column's real rendered height in JS rather than
  // relying on flex `stretch` alone — with no fixed height anywhere in the
  // feed panel, `stretch` and the feed's own `h-full`/`flex-1` become
  // mutually circular (the feed's own alert-list content decides its
  // "natural" size, which can end up taller than the cards and pulls the
  // whole row up to match it, instead of the other way around). A
  // ResizeObserver sidesteps that: once we have a concrete pixel number,
  // percentage/flex heights downstream resolve unambiguously. Only applied
  // at the `lg` breakpoint, where the columns actually sit side by side.
  //
  // useLayoutEffect (not useEffect) so this first measurement happens
  // before the browser paints — otherwise the panel visibly flashes from
  // the 520px fallback to its real height one frame later. A second, later
  // jump can still happen once async data (e.g. Attack Types) finishes
  // loading and changes the left column's height for real — that one's
  // unavoidable without knowing the data's size in advance, and it's the
  // same shift the left column itself would show regardless of this fix.
  useLayoutEffect(() => {
    const el = leftColRef.current
    if (!el) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    const measure = () => setFeedHeight(desktop.matches ? el.getBoundingClientRect().height : null)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    desktop.addEventListener('change', measure)
    measure()
    return () => {
      ro.disconnect()
      desktop.removeEventListener('change', measure)
    }
  }, [])

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
      setApiOnline(true)
      setApiError(null)
    } catch (error) {
      console.error(error)
      setApiOnline(false)
      setApiError(error.message || 'ThreatScope API is unavailable.')
    }
  }, [])

  useEffect(() => {
    refreshScanStatus()
    const id = setInterval(refreshScanStatus, 5000)
    return () => clearInterval(id)
  }, [refreshScanStatus])

  useEffect(() => {
    const refreshApiHealth = async () => {
      try {
        await getApiHealth()
        setApiOnline(true)
        setApiError(null)
      } catch (error) {
        setApiOnline(false)
        setApiError(error.message || 'ThreatScope API is unavailable.')
      }
    }
    refreshApiHealth()
    const id = setInterval(refreshApiHealth, 30000)
    return () => clearInterval(id)
  }, [])

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
      setAiError(error.message || 'AI analysis failed. Check the configured provider and try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleRunScan = async () => {
    setScanLoading(true)
    setScanError(null)
    try {
      setScanStatus(await runScanNow())
    } catch (error) {
      console.error(error)
      setScanError(error.message || 'Unable to start the network assessment.')
    } finally {
      setScanLoading(false)
    }
  }

  const handleMonitoring = async (enabled) => {
    const previousStatus = scanStatus
    setScanLoading(true)
    setScanError(null)
    setScanStatus(current => current ? {
      ...current,
      sensor: {
        ...current.sensor,
        desired_monitoring: enabled,
      },
    } : current)
    try {
      setScanStatus(await setSensorMonitoring(enabled))
    } catch (error) {
      console.error(error)
      setScanStatus(previousStatus)
      setScanError(error.message || 'Unable to update continuous monitoring.')
    } finally {
      setScanLoading(false)
    }
  }

  const handleSchedule = async (enabled, intervalMinutes = scanStatus?.interval_minutes || 5) => {
    setScanLoading(true)
    setScanError(null)
    try {
      setScanStatus(await setScanSchedule(enabled, intervalMinutes))
    } catch (error) {
      console.error(error)
      setScanError(error.message || 'Unable to update the assessment schedule.')
    } finally {
      setScanLoading(false)
    }
  }

  const displayAlerts = paused ? frozenRef.current : wsAlerts.slice(0, FEED_LIMIT)
  if (!paused) frozenRef.current = displayAlerts

  const totalDisplay  = useCountUp(summary.total)
  const highDisplay   = useCountUp(summary.high)
  const mediumDisplay = useCountUp(summary.medium)
  const lowDisplay    = useCountUp(summary.low)

  const STATS = [
    { label: 'Total',  value: totalDisplay,  tone: 'text-signal' },
    { label: 'High',   value: highDisplay,   tone: 'text-severity-high' },
    { label: 'Medium', value: mediumDisplay, tone: 'text-severity-medium' },
    { label: 'Low',    value: lowDisplay,    tone: 'text-severity-low' },
  ]

  const scanState = mapScanState(scanStatus)

  return (
    <main className="relative">

      {/* Noise texture — page-level, fixed, same treatment as Landing/AuthLayout. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: `url("${NOISE_DATA_URI}")`, backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }} />

      {/* Ambient wash — fixed to the viewport corner, constant signal teal
          regardless of scan state (the mock never recolors this; only the
          hero text and rings signal alert). */}
      <div aria-hidden="true" className="pointer-events-none fixed -right-[160px] -top-[220px] z-0 h-[640px] w-[640px] animate-breathe rounded-full bg-signal blur-[90px]" />

      {/* Centered content column — mirrors the mock's `.page` as ONE element
          (max-width 1320px, its own padding, border-box) so the content
          area is 1320px total including padding, not 1320px on top of a
          separate outer padding — that double-counting is what made every
          card render wider than the mock's.

          Body text uses the app's normal IBM Plex Sans (font-sans) — that's
          also the mock's OWN first-choice body font ('IBM Plex Sans',
          -apple-system, ...); the mock's sandbox just couldn't download it
          and silently fell back to -apple-system, but our app loads it for
          real, so no override is needed here. */}
      <div className="relative z-10 mx-auto max-w-[1320px] px-8 pb-[60px] pt-7">

      {/* Scan status hero */}
      <section className="relative mb-[22px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[linear-gradient(160deg,rgba(46,235,209,0.07),rgba(13,19,27,0.4)_55%)] px-9 pb-7 pt-[34px]">

        {/* Concentric rings — one static anchor at full size (0 inset) plus
            three staggered pulsing rings nested inside it (34/68/102px
            insets), exactly the mock's structure. Positioned against this
            `relative` hero section specifically — without that, `top-1/2`
            resolves against the page wrapper instead and the rings end up
            far below the hero. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-1/2 h-[340px] w-[340px] -translate-y-1/2 opacity-50">
          <div className={`absolute inset-0 rounded-full border opacity-[0.16] ${scanRingBorderClass(scanState)}`} />
          <div className={`absolute inset-[34px] rounded-full border animate-ring-pulse opacity-[0.16] ${scanRingBorderClass(scanState)}`} />
          <div className={`absolute inset-[68px] rounded-full border animate-ring-pulse opacity-[0.16] ${scanRingBorderClass(scanState)}`} style={{ animationDelay: '0.8s' }} />
          <div className={`absolute inset-[102px] rounded-full border animate-ring-pulse opacity-[0.16] ${scanRingBorderClass(scanState)}`} style={{ animationDelay: '1.6s' }} />
          {RADAR_DOTS.map((dot, i) => (
            <span
              key={i}
              className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-radar-ping rounded-full ${scanDotClass(scanState)}`}
              style={radarDotStyle(dot)}
            />
          ))}
        </div>

        <div className="relative">
          <p
            className={`mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-signal transition-all duration-300 ease-swift ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-blink" />
            Live Network Status
          </p>

          <h1
            className={`mb-1.5 text-balance text-[clamp(40px,6vw,72px)] font-bold leading-none tracking-[-0.02em] transition-all duration-300 ease-swift ${scanHeroColorClass(scanState)} ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
            style={{ transitionDelay: '60ms', fontFamily: "Futura, 'Century Gothic', 'IBM Plex Sans', sans-serif" }}
          >
            {scanHeadline(scanStatus)}
          </h1>

          <p
            className={`mb-[22px] max-w-[52ch] text-sm leading-[1.55] text-ink-muted transition-all duration-300 ease-swift ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            style={{ transitionDelay: '120ms' }}
          >
            {scanMessage(scanStatus, summary)}
          </p>

          {scanError && (
            <p className="mb-4 flex max-w-[70ch] items-center gap-2 text-sm text-severity-high">
              <AlertTriangle size={15} /> {scanError}
            </p>
          )}
          {apiError && (
            <p className="mb-4 flex max-w-[70ch] items-center gap-2 text-sm text-severity-high">
              <AlertTriangle size={15} /> {apiError}
            </p>
          )}

          {chartData.length > 0 && (
            <div
              className={`mb-[22px] flex items-center gap-[10px] transition-all duration-300 ease-swift ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
              style={{ transitionDelay: '160ms' }}
            >
              <svg viewBox="0 0 200 32" className="h-[34px] w-[180px] text-signal" preserveAspectRatio="none">
                <polyline points={sparkPoints(chartData)} fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="font-mono text-[11px] text-ink-faint">this session · event volume</span>
            </div>
          )}

          <div
            className={`mb-5 flex flex-wrap gap-[22px] transition-all duration-300 ease-swift ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            style={{ transitionDelay: '200ms' }}
          >
            {STATS.map(({ label, value, tone }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className={`font-mono text-[26px] font-bold tabular-nums ${tone}`}>{value}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-ink-faint">{label}</span>
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-ink-faint">
            <span>
              Cloud API: <b className={apiOnline ? 'text-severity-low' : 'text-severity-high'}>
                {apiOnline === null ? 'checking' : apiOnline ? 'online' : 'offline'}
              </b>
            </span>
            <span>
              Sensor: <b className={scanStatus?.sensor?.online ? 'text-severity-low' : 'text-severity-high'}>
                {scanStatus?.sensor?.online ? 'online' : 'offline'}
              </b>
            </span>
            <span>Interface: <b className="text-ink-muted">{scanStatus?.sensor?.interface || 'not connected'}</b></span>
            <span>Packets observed: <b className="text-ink-muted">{scanStatus?.sensor?.packet_count ?? 0}</b></span>
            {scanStatus?.packets_analyzed > 0 && (
              <span>Latest assessment: <b className="text-ink-muted">{scanStatus.packets_analyzed} packets</b></span>
            )}
          </div>

          <div
            className={`flex flex-wrap items-center gap-[10px] transition-all duration-300 ease-swift ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            style={{ transitionDelay: '240ms' }}
          >
            {!scanStatus?.sensor?.online ? (
              <Button variant="primary" size="sm" disabled>
                <Loader2 size={14} className="animate-spin" /> Waiting for sensor
              </Button>
            ) : scanStatus?.sensor?.desired_monitoring ? (
              <Button variant="danger" size="sm" onClick={() => handleMonitoring(false)} disabled={scanLoading}>
                <PauseCircle size={14} /> Stop monitoring
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => handleMonitoring(true)} disabled={scanLoading}>
                {scanLoading ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                Start continuous monitoring
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunScan}
              disabled={scanLoading || apiOnline === false || scanStatus?.state === 'running' || !scanStatus?.sensor?.online || !scanStatus?.sensor?.desired_monitoring || !scanStatus?.sensor?.monitoring}
            >
              {(scanLoading || scanStatus?.state === 'running') && <Loader2 size={14} className="animate-spin" />}
              {scanStatus?.state === 'running' ? 'Assessment running...' : 'Assess now'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSchedule(true, 5)} disabled={scanLoading || apiOnline === false || !scanStatus?.sensor?.desired_monitoring || !scanStatus?.sensor?.monitoring}>
              Every 5 min
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleSchedule(true, 10)} disabled={scanLoading || apiOnline === false || !scanStatus?.sensor?.desired_monitoring || !scanStatus?.sensor?.monitoring}>
              Every 10 min
            </Button>
            {scanStatus?.enabled && (
              <Button variant="danger" size="sm" onClick={() => handleSchedule(false, scanStatus.interval_minutes)} disabled={scanLoading}>
                Stop schedule
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Two-column body: charts + AI (left) / live feed (right) — 340px
          sidebar, 18px gaps. Default flex cross-axis is `stretch`, so the
          feed column naturally matches the left column's full height. */}
      <div className="flex flex-col gap-[18px] lg:flex-row">
        <div className="min-w-0 flex-1" ref={leftColRef}>

          {/* Attack Surface — full-width standalone panel (not squeezed into
              a row with Attack Types), so the heat strip reads as one long
              smooth horizontal bar the way the mock's does. */}
          <section className="mb-[18px] animate-fade-up rounded-xl border border-white/[0.08] bg-surface px-[22px] py-5" style={{ animationDelay: '40ms' }}>
            <h2 className={PANEL_H2}>Attack Surface</h2>
            <p className={PANEL_HINT}>Severity distribution across the last {summary.total} events — segmented, not siloed into separate cards.</p>
            <div className="mb-2.5 flex h-3.5 overflow-hidden rounded-lg bg-surface-2">
              <div className="h-full bg-severity-high shadow-[inset_0_0_12px_rgba(239,68,68,0.5)] transition-[width] duration-[1100ms] ease-swift" style={{ width: `${heatPct(summary.high, summary.total)}%` }} />
              <div className="h-full bg-severity-medium transition-[width] duration-[1100ms] ease-swift" style={{ width: `${heatPct(summary.medium, summary.total)}%` }} />
              <div className="h-full bg-severity-low transition-[width] duration-[1100ms] ease-swift" style={{ width: `${heatPct(summary.low, summary.total)}%` }} />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
              <span>High <b className="font-semibold text-severity-high">{heatPct(summary.high, summary.total)}%</b></span>
              <span>Medium <b className="font-semibold text-severity-medium">{heatPct(summary.medium, summary.total)}%</b></span>
              <span>Low <b className="font-semibold text-severity-low">{heatPct(summary.low, summary.total)}%</b></span>
            </div>
          </section>

          {/* Live network pulse — real packet-count deltas from the sensor.
              The traveling highlight moves continuously, while the curve
              itself changes only when captured packet totals change. */}
          <section className="mb-[18px] animate-fade-up rounded-xl border border-white/[0.08] bg-surface px-[22px] py-5" style={{ animationDelay: '80ms' }}>
            <h2 className={PANEL_H2}>Live Network Pulse</h2>
            <p className={PANEL_HINT}>
              Captured packet activity from the connected sensor · sampled every 5 seconds.
            </p>
            <div className="h-[120px] overflow-hidden rounded-lg bg-gradient-to-b from-signal/[0.05] to-transparent">
              <NetworkPulse
                packetCount={scanStatus?.sensor?.packet_count}
                active={Boolean(scanStatus?.sensor?.online && scanStatus?.sensor?.monitoring)}
              />
            </div>
          </section>

          {/* AI developer diagnostics — same states as before (error / empty /
              loading / result), rendered as a terminal readout instead of a
              bordered text block. */}
          <section className="animate-fade-up rounded-xl border border-white/[0.08] bg-surface px-[22px] py-5" style={{ animationDelay: '120ms' }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className={PANEL_H2}>AI Analysis</h2>
                <p className="text-[11px] leading-[normal] text-ink-faint">Advisory diagnostics from the configured AI provider, rendered as a live readout.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleAnalyzeAlerts} disabled={aiLoading || apiOnline === false}>
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                {aiLoading ? 'Analyzing...' : 'Analyze recent alerts'}
              </Button>
            </div>

            <div className="overflow-hidden rounded-[10px] border border-white/[0.12] bg-base">
              <div className="flex items-center gap-1.5 border-b border-white/[0.08] bg-surface-2 px-3 py-2">
                <span className="h-[7px] w-[7px] rounded-full bg-white/[0.12]" />
                <span className="h-[7px] w-[7px] rounded-full bg-white/[0.12]" />
                <span className="h-[7px] w-[7px] rounded-full bg-white/[0.12]" />
                <span className="ml-1 text-[10px] text-ink-faint">threatscope-ai · analysis.log</span>
              </div>
              <div className="px-4 py-3.5 font-mono text-[12.5px] leading-[1.7]">
                {aiError && (
                  <p className="flex items-center gap-2 text-severity-high">
                    <AlertTriangle size={14} /> {aiError}
                  </p>
                )}

                {!aiError && !aiResult && !aiLoading && (
                  <p className="text-ink-faint">
                    <span className="text-signal">&gt;</span> waiting for analysis
                    <span className="ml-1 inline-block h-[13px] w-1.5 animate-cursor-blink bg-signal align-middle" />
                  </p>
                )}

                {aiLoading && (
                  <p className="text-ink-muted"><span className="text-signal">&gt;</span> analyzing {aiResult?.alert_count ?? summary.total} alerts…</p>
                )}

                {aiResult && (
                  <div className="flex flex-col gap-1.5 text-ink-muted">
                    <p><span className="text-signal">&gt;</span> model: {aiResult.model} · {aiResult.alert_count} alerts analyzed</p>
                    <p><span className="text-signal">&gt;</span> pattern: {aiResult.pattern}</p>
                    <p><span className="text-signal">&gt;</span> summary: {aiResult.summary}</p>
                    <p><span className="text-signal">&gt;</span> risk_level: <b className={riskTextClass(aiResult.risk_level)}>{aiResult.risk_level}</b></p>
                    {aiResult.rule_tuning_suggestions?.length > 0 && (
                      <div className="mt-1">
                        <p className="text-ink-faint">&gt; rule tuning suggestions:</p>
                        <ul className="ml-4 list-disc">
                          {aiResult.rule_tuning_suggestions.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-ink-faint">{aiResult.demo_note} · {aiResult.disclaimer}</p>
                    <p className="mt-1">
                      <span className="text-signal">&gt;</span> _<span className="ml-0.5 inline-block h-[13px] w-1.5 animate-cursor-blink bg-signal align-middle" />
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Attack Types — real functional data the mock never showed;
              moved here after the mock-matching sequence (Attack Surface /
              Live Network Pulse / AI Analysis) instead of competing with
              Attack Surface for width in a cramped side-by-side row. */}
          <section className="mt-[18px] animate-fade-up rounded-xl border border-white/[0.08] bg-surface px-[22px] py-5" style={{ animationDelay: '160ms' }}>
            <h2 className={PANEL_H2}>Attack Types</h2>
            <AttackTypeChart data={typeStats} />
          </section>
        </div>

        {/* Live alert feed — stretches to match the left column's full
            height (flex `stretch` is the default cross-axis behavior on the
            outer row, so this just needs to opt in down through the tree)
            instead of stopping at a fixed 520px. Header stays a fixed
            height at the top; only the line list flexes to fill whatever
            space is left, so its bottom edge lands exactly level with
            Attack Types. `min-h-0` is required here — flex children default
            to a content-based min-height, which would otherwise stop this
            from shrinking to fit and break its internal scroll. */}
        <aside className="w-full shrink-0 animate-fade-up lg:w-[340px]" style={{ animationDelay: '200ms' }}>
          <section
            className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-surface"
            style={{ height: feedHeight ? `${feedHeight}px` : '520px' }}
          >
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-[11px] font-mono text-[11px] text-ink-faint">
              <span>live_feed.stream</span>
              <span className={`ml-auto flex items-center gap-1.5 text-[10px] ${connected ? 'text-severity-low' : 'text-severity-high'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-severity-low animate-live-blink' : 'bg-severity-high'}`} />
                {connected ? 'feed connected' : 'feed offline'}
              </span>
              <Button variant="ghost" size="sm" className="group ml-1" onClick={() => setPaused(p => !p)}>
                {paused
                  ? <><PlayCircle  size={14} className="transition-transform duration-200 ease-swift group-hover:scale-110" /> Resume</>
                  : <><PauseCircle size={14} className="transition-transform duration-200 ease-swift group-hover:scale-110" /> Pause</>}
              </Button>
            </div>
            <div className="feed-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3.5 text-xs leading-[1.9]" style={{ scrollbarWidth: 'thin' }}>
              {displayAlerts.length === 0
                ? <p className="italic text-ink-faint">No alerts detected yet. Listening...</p>
                : displayAlerts.map((alert, i) => <AlertCard key={alert.id ?? i} alert={alert} />)
              }
            </div>
          </section>
        </aside>
      </div>

      </div>
    </main>
  )
}

function riskTextClass(riskLevel) {
  if (riskLevel === 'HIGH') return 'text-severity-high'
  if (riskLevel === 'LOW') return 'text-severity-low'
  return 'text-severity-medium'
}

function scanHeadline(scanStatus) {
  if (!scanStatus?.sensor?.online) return 'Sensor Offline'
  if (scanStatus?.sensor?.last_error) return 'Sensor Error'
  if (!scanStatus?.sensor?.desired_monitoring) return 'Monitoring Paused'
  if (!scanStatus?.sensor?.monitoring) return 'Starting Sensor'
  if (scanStatus?.state === 'running') return 'Assessment Running'
  if (scanStatus?.state === 'threats_found') return 'Threats detected'
  if (scanStatus?.state === 'no_data') return 'No Traffic Observed'
  if (scanStatus?.state === 'sensor_offline') return 'Sensor Offline'
  if (scanStatus?.state === 'secure') return 'No Known Threats Detected'
  return 'Continuous Monitoring Active'
}

function scanMessage(scanStatus, summary) {
  if (!scanStatus?.sensor?.online) {
    return 'ThreatScope cannot inspect this network because no sensor service is connected. Install or start the sensor before assessing network safety.'
  }
  if (scanStatus?.sensor?.last_error) return scanStatus.sensor.last_error
  if (!scanStatus?.sensor?.desired_monitoring) {
    return scanStatus?.sensor?.monitoring
      ? 'Pause requested. The sensor will stop packet inspection on its next heartbeat.'
      : 'The sensor service is online, but packet inspection is paused. Start continuous monitoring to detect network threats.'
  }
  if (!scanStatus?.sensor?.monitoring) return 'The sensor is online and preparing packet capture.'
  if (scanStatus?.state === 'running') {
    return 'ThreatScope is actively inspecting network packets. New alerts will appear below if suspicious traffic is found.'
  }
  if (scanStatus?.state === 'threats_found') return scanStatus.message
  if (scanStatus?.state === 'no_data' || scanStatus?.state === 'sensor_offline') return scanStatus.message
  if (scanStatus?.state === 'secure') {
    const scheduleClause = scanStatus?.enabled
      ? `assessments continue every ${scanStatus.interval_minutes} minutes`
      : 'scheduled assessments are currently off'
    return `${scanStatus.message} ${summary.total} alerts stored this session; ${scheduleClause}.`
  }
  return 'The sensor is continuously inspecting traffic. Run an assessment to produce a verified safety result for a measured packet window.'
}

// 4 states (scanning/alert/secure/monitoring), derived from the exact same
// conditions scanHeadline/scanMessage already check — kept as one shared
// mapper so the hero text color and ring color can't drift out of sync.
// Only "alert" gets its own color anywhere; every other state shares
// ThreatScope's own signal teal, matching the mock (which never recolors
// anything except the giant status text and the rings during an alert).
function mapScanState(scanStatus) {
  if (!scanStatus?.sensor?.online || scanStatus?.state === 'sensor_offline') return 'offline'
  if (scanStatus?.sensor?.last_error) return 'offline'
  if (!scanStatus?.sensor?.desired_monitoring) return 'paused'
  if (!scanStatus?.sensor?.monitoring) return 'paused'
  if (scanStatus?.state === 'running') return 'scanning'
  if (scanStatus?.state === 'threats_found') return 'alert'
  if (scanStatus?.state === 'no_data') return 'no-data'
  if (scanStatus?.state === 'secure') return 'secure'
  return 'monitoring'
}

function scanHeroColorClass(state) {
  if (state === 'alert' || state === 'offline') return 'text-severity-high'
  if (state === 'paused' || state === 'no-data') return 'text-severity-medium'
  return 'text-signal'
}

function scanRingBorderClass(state) {
  if (state === 'alert' || state === 'offline') return 'border-severity-high'
  if (state === 'paused' || state === 'no-data') return 'border-severity-medium'
  return 'border-signal'
}

function scanDotClass(state) {
  if (state === 'alert' || state === 'offline') return 'bg-severity-high'
  if (state === 'paused' || state === 'no-data') return 'bg-severity-medium'
  return 'bg-signal'
}
