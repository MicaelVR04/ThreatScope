import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Activity, ShieldAlert, AlertTriangle, Info, PauseCircle, PlayCircle } from 'lucide-react'
import Button from '../components/theme/Button'
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

const SEV = {
  HIGH:   { color: '#ef4444', icon: <ShieldAlert  size={18} color="#ef4444" /> },
  MEDIUM: { color: '#f59e0b', icon: <AlertTriangle size={18} color="#f59e0b" /> },
  LOW:    { color: '#22c55e', icon: <Info          size={18} color="#22c55e" /> },
}

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

  const CARDS = [
    { label: 'Total',  value: summary.total,  color: '#6366f1', icon: <Activity size={18} color="#6366f1" /> },
    { label: 'High',   value: summary.high,   ...SEV.HIGH },
    { label: 'Medium', value: summary.medium, ...SEV.MEDIUM },
    { label: 'Low',    value: summary.low,    ...SEV.LOW },
  ]

  return (
    <main style={styles.main}>

      {/* Scan status */}
      <section style={{ ...styles.scanPanel, ...scanPanelTone(scanStatus, summary) }}>
        <div style={styles.scanHeader}>
          <div>
            <h1 style={styles.scanTitle}>{scanHeadline(scanStatus, summary)}</h1>
            <p style={styles.scanText}>{scanMessage(scanStatus, summary)}</p>
          </div>
          <div style={styles.scanActions}>
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
        <div style={styles.scanMeta}>
          <span>Scheduled scans: {scanStatus?.enabled ? `on every ${scanStatus.interval_minutes} minutes` : 'off'}</span>
          {scanStatus?.next_scan_at && <span>Next scan: {new Date(scanStatus.next_scan_at).toLocaleTimeString()}</span>}
          {scanStatus?.last_finished_at && <span>Last finished: {new Date(scanStatus.last_finished_at).toLocaleTimeString()}</span>}
        </div>
      </section>

      {/* Summary cards */}
      <div style={styles.cards}>
        {CARDS.map(({ label, value, color, icon }) => (
          <div key={label} style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
            <div style={styles.cardHeader}>{icon}<span style={styles.cardLabel}>{label}</span></div>
            <span style={{ ...styles.cardValue, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={styles.chartsRow}>
        <section style={styles.chartCard}>
          <h2 style={styles.sectionTitle}>Severity Breakdown</h2>
          <SeverityChart data={summary} />
        </section>
        <section style={{ ...styles.chartCard, flex: 2 }}>
          <h2 style={styles.sectionTitle}>Attack Types</h2>
          <AttackTypeChart data={typeStats} />
        </section>
      </div>

      {/* Time-series area chart */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Alert Activity Over Time</h2>
        {chartData.length === 0 ? (
          <p style={styles.empty}>No stats data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {Object.entries(SEV).map(([k, { color }]) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" stroke="#475569" tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8', fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              {Object.entries(SEV).map(([k, { color }]) => (
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
      <section style={styles.aiSection}>
        <div style={styles.aiHeader}>
          <div>
            <h2 style={styles.sectionTitle}>AI Analysis</h2>
            <p style={styles.aiSubtext}>Developer diagnostics from local Ollama. Rule detections stay authoritative.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleAnalyzeAlerts} disabled={aiLoading}>
            <Activity size={14} />
            {aiLoading ? 'Analyzing...' : 'Analyze recent alerts'}
          </Button>
        </div>

        {aiError && (
          <div style={styles.aiError}>
            <AlertTriangle size={16} />
            <span>{aiError}</span>
          </div>
        )}

        {!aiError && !aiResult && (
          <p style={styles.aiEmpty}>Run analysis after alerts appear in the dashboard.</p>
        )}

        {aiResult && (
          <div style={styles.aiResult}>
            <div style={styles.aiMeta}>
              <span style={styles.aiMetaItem}>Model: {aiResult.model}</span>
              <span style={styles.aiMetaItem}>{aiResult.alert_count} alerts analyzed</span>
              <span style={{ ...styles.aiRisk, ...riskStyle(aiResult.risk_level) }}>{aiResult.risk_level}</span>
            </div>
            <p style={styles.aiText}><strong>Summary:</strong> {aiResult.summary}</p>
            <p style={styles.aiText}><strong>Pattern:</strong> {aiResult.pattern}</p>
            <p style={styles.aiText}><strong>Demo note:</strong> {aiResult.demo_note}</p>
            {aiResult.rule_tuning_suggestions?.length > 0 && (
              <div>
                <p style={styles.aiLabel}>Rule tuning suggestions</p>
                <ul style={styles.aiList}>
                  {aiResult.rule_tuning_suggestions.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <p style={styles.aiDisclaimer}>{aiResult.disclaimer}</p>
          </div>
        )}
      </section>

      {/* Live alert feed */}
      <section style={styles.section}>
        <div style={styles.feedHeader}>
          <h2 style={styles.sectionTitle}>Live Alert Feed</h2>
          <span style={styles.feedCount}>{wsAlerts.length} received</span>
          <Button variant="ghost" size="sm" onClick={() => setPaused(p => !p)}>
            {paused
              ? <><PlayCircle  size={14} /> Resume</>
              : <><PauseCircle size={14} /> Pause</>}
          </Button>
        </div>
        {displayAlerts.length === 0
          ? <p style={styles.empty}>No alerts detected yet. Listening...</p>
          : displayAlerts.map((alert, i) => <AlertCard key={alert.id ?? i} alert={alert} />)
        }
      </section>

    </main>
  )
}

function riskStyle(riskLevel) {
  if (riskLevel === 'HIGH') return { borderColor: '#ef444440', color: '#ef4444' }
  if (riskLevel === 'LOW') return { borderColor: '#22c55e40', color: '#22c55e' }
  return { borderColor: '#f59e0b40', color: '#f59e0b' }
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

function scanPanelTone(scanStatus, summary) {
  if (scanStatus?.state === 'threats_found') return { borderColor: '#ef444440', background: '#7f1d1d22' }
  if (scanStatus?.state === 'running') return { borderColor: '#6366f166', background: '#312e8122' }
  if (scanStatus?.state === 'secure' || summary.total === 0) return { borderColor: '#22c55e55', background: '#064e3b22' }
  return { borderColor: '#334155', background: '#1e293b' }
}

const styles = {
  main:         { padding: '24px 32px' },
  scanPanel:    { border: '1px solid', borderRadius: 8, padding: '18px 20px', marginBottom: 24 },
  scanHeader:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
  scanTitle:    { fontSize: 22, color: '#f1f5f9', margin: '0 0 6px' },
  scanText:     { color: '#cbd5e1', fontSize: 14, lineHeight: 1.55, maxWidth: 760 },
  scanActions:  { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  scanBtn:      { background: '#111827', border: '1px solid #6366f1', color: '#c7d2fe', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  stopBtn:      { background: '#111827', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  scanMeta:     { display: 'flex', gap: 12, flexWrap: 'wrap', color: '#94a3b8', fontSize: 12, marginTop: 12 },
  cards:        { display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' },
  card:         { flex: 1, minWidth: 140, background: '#1e293b', borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  cardHeader:   { display: 'flex', alignItems: 'center', gap: 8 },
  cardLabel:    { fontSize: 13, color: '#94a3b8' },
  cardValue:    { fontSize: 34, fontWeight: 'bold' },
  chartsRow:    { display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' },
  chartCard:    { flex: 1, minWidth: 260, background: '#1e293b', borderRadius: 8, padding: '20px 24px' },
  section:      { marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  aiSection:    { marginBottom: 32, background: '#1e293b', borderRadius: 8, padding: '20px 24px', border: '1px solid #334155' },
  aiHeader:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  aiSubtext:    { color: '#64748b', fontSize: 13, marginTop: -4 },
  aiButton:     { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #6366f1', borderRadius: 6, padding: '8px 12px', background: '#111827', color: '#c7d2fe', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  aiEmpty:      { color: '#64748b', fontStyle: 'italic', fontSize: 14 },
  aiError:      { display: 'flex', alignItems: 'center', gap: 8, color: '#fca5a5', background: '#7f1d1d33', border: '1px solid #ef444440', borderRadius: 6, padding: '10px 12px', fontSize: 13 },
  aiResult:     { display: 'flex', flexDirection: 'column', gap: 10 },
  aiMeta:       { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 2 },
  aiMetaItem:   { color: '#94a3b8', fontSize: 12, border: '1px solid #334155', borderRadius: 99, padding: '4px 9px' },
  aiRisk:       { fontSize: 12, fontWeight: 800, border: '1px solid', borderRadius: 99, padding: '4px 9px' },
  aiText:       { color: '#cbd5e1', fontSize: 14, lineHeight: 1.55 },
  aiLabel:      { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, marginBottom: 6 },
  aiList:       { color: '#cbd5e1', fontSize: 14, lineHeight: 1.55, paddingLeft: 20 },
  aiDisclaimer: { color: '#64748b', fontSize: 12, marginTop: 2 },
  feedHeader:   { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  feedCount:    { fontSize: 12, color: '#475569', flex: 1 },
  pauseBtn:     { display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  empty:        { color: '#475569', fontStyle: 'italic' },
}
