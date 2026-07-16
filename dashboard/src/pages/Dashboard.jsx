import { useState, useEffect, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Activity, ShieldAlert, AlertTriangle, Info, PauseCircle, PlayCircle } from 'lucide-react'
import AlertCard from '../components/AlertCard'
import SeverityChart from '../components/SeverityChart'
import AttackTypeChart from '../components/AttackTypeChart'
import useWebSocket from '../hooks/useWebSocket'
import { getAlertsSummary, getAlertStats, getAttackTypeStats } from '../services/api'

const SEV = {
  HIGH:   { color: '#ef4444', icon: <ShieldAlert  size={18} color="#ef4444" /> },
  MEDIUM: { color: '#f59e0b', icon: <AlertTriangle size={18} color="#f59e0b" /> },
  LOW:    { color: '#22c55e', icon: <Info          size={18} color="#22c55e" /> },
}

const FEED_LIMIT = 20

export default function Dashboard({ onConnectionChange }) {
  const { alerts: wsAlerts, receivedCount, connected } = useWebSocket()
  const [summary,    setSummary]    = useState({ total: 0, high: 0, medium: 0, low: 0 })
  const [chartData,  setChartData]  = useState([])
  const [typeStats,  setTypeStats]  = useState([])
  const [paused,     setPaused]     = useState(false)
  const [error,      setError]      = useState(null)
  const frozenRef = useRef([])

  // Propagate connection state up to App / Navbar, and clear it on unmount
  // so the Navbar doesn't keep showing "LIVE" after navigating away.
  useEffect(() => {
    onConnectionChange?.(connected)
    return () => onConnectionChange?.(false)
  }, [connected, onConnectionChange])

  // Fetch summary counts
  useEffect(() => {
    getAlertsSummary().then(setSummary).catch(err => setError(err.message))
  }, [])

  // Fetch time-series chart data from /alerts/stats
  useEffect(() => {
    getAlertStats().then(setChartData).catch(err => setError(err.message))
  }, [])

  // Fetch attack-type breakdown from /alerts/stats?group_by=type
  useEffect(() => {
    getAttackTypeStats().then(setTypeStats).catch(err => setError(err.message))
  }, [])

  // Freeze the feed when paused
  const displayAlerts = paused ? frozenRef.current : wsAlerts.slice(0, FEED_LIMIT)
  useEffect(() => {
    if (!paused) frozenRef.current = displayAlerts
  })

  const CARDS = [
    { label: 'Total',  value: summary.total,  color: '#6366f1', icon: <Activity size={18} color="#6366f1" /> },
    { label: 'High',   value: summary.high,   ...SEV.HIGH },
    { label: 'Medium', value: summary.medium, ...SEV.MEDIUM },
    { label: 'Low',    value: summary.low,    ...SEV.LOW },
  ]

  return (
    <main style={styles.main}>

      {error && <p style={styles.error}>Error: {error}</p>}

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

        {/* Severity donut — /alerts/summary */}
        <section style={styles.chartCard}>
          <h2 style={styles.sectionTitle}>Severity Breakdown</h2>
          <SeverityChart data={summary} />
        </section>

        {/* Attack type bar — /alerts/stats?group_by=type */}
        <section style={{ ...styles.chartCard, flex: 2 }}>
          <h2 style={styles.sectionTitle}>Attack Types</h2>
          <AttackTypeChart data={typeStats} />
        </section>

      </div>

      {/* Time-series area chart — /alerts/stats */}
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

      {/* Live alert feed */}
      <section style={styles.section}>
        <div style={styles.feedHeader}>
          <h2 style={styles.sectionTitle}>Live Alert Feed</h2>
          <span style={styles.feedCount}>{receivedCount} received</span>
          <button style={styles.pauseBtn} onClick={() => setPaused(p => !p)}>
            {paused
              ? <><PlayCircle  size={14} /> Resume</>
              : <><PauseCircle size={14} /> Pause</>}
          </button>
        </div>
        {displayAlerts.length === 0
          ? <p style={styles.empty}>No alerts detected yet. Listening...</p>
          : displayAlerts.map((alert, i) => <AlertCard key={alert.id ?? i} alert={alert} />)
        }
      </section>

    </main>
  )
}

const styles = {
  main:         { padding: '24px 32px' },
  cards:        { display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' },
  card:         { flex: 1, minWidth: 140, background: '#1e293b', borderRadius: 8, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  cardHeader:   { display: 'flex', alignItems: 'center', gap: 8 },
  cardLabel:    { fontSize: 13, color: '#94a3b8' },
  cardValue:    { fontSize: 34, fontWeight: 'bold' },
  chartsRow:    { display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' },
  chartCard:    { flex: 1, minWidth: 260, background: '#1e293b', borderRadius: 8, padding: '20px 24px' },
  section:      { marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  feedHeader:   { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  feedCount:    { fontSize: 12, color: '#475569', flex: 1 },
  pauseBtn:     { display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  empty:        { color: '#475569', fontStyle: 'italic' },
  error:        { color: '#ef4444', marginBottom: 16 },
}
