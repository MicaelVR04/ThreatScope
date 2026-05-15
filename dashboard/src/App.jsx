/**
 * App.jsx — Main dashboard component for ThreatScope
 * Person 3 owns this file.
 *
 * Responsibilities:
 * - Connect to the API WebSocket for real-time alerts
 * - Display live alert feed
 * - Show severity summary cards
 * - Render traffic chart
 *
 * This is the base scaffold — build your components from here.
 */

import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000/ws'

// Severity color mapping
const SEVERITY_COLORS = {
  HIGH:   '#ef4444',  // red
  MEDIUM: '#f59e0b',  // yellow
  LOW:    '#22c55e',  // green
}

export default function App() {
  const [alerts, setAlerts]   = useState([])   // live alert feed
  const [summary, setSummary] = useState({ total: 0, high: 0, medium: 0, low: 0 })
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  // ── Fetch alert history on load ─────────────────────────────────────────
  useEffect(() => {
    fetch(⁠ ${API_URL}/alerts ⁠)
      .then(res => res.json())
      .then(data => setAlerts(data))
      .catch(err => console.error('Failed to fetch alerts:', err))

    fetch(⁠ ${API_URL}/alerts/summary ⁠)
      .then(res => res.json())
      .then(data => setSummary(data))
      .catch(err => console.error('Failed to fetch summary:', err))
  }, [])

  // ── WebSocket connection for real-time alerts ───────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnected(true)
    }

    ws.onmessage = (event) => {
      const alert = JSON.parse(event.data)

      // Add new alert to the top of the feed
      setAlerts(prev => [alert, ...prev])

      // Update summary counts
      setSummary(prev => ({
        total:  prev.total + 1,
        high:   alert.severity === 'HIGH'   ? prev.high   + 1 : prev.high,
        medium: alert.severity === 'MEDIUM' ? prev.medium + 1 : prev.medium,
        low:    alert.severity === 'LOW'    ? prev.low    + 1 : prev.low,
      }))
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    // Cleanup on unmount
    return () => ws.close()
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>

      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>🛡️ ThreatScope</h1>
        <span style={{ ...styles.badge, background: connected ? '#22c55e' : '#ef4444' }}>
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
      </header>

      {/* Summary Cards */}
      <div style={styles.cards}>
        <SummaryCard label="Total Alerts" value={summary.total} color="#6366f1" />
        <SummaryCard label="High"         value={summary.high}   color={SEVERITY_COLORS.HIGH} />
        <SummaryCard label="Medium"       value={summary.medium} color={SEVERITY_COLORS.MEDIUM} />
        <SummaryCard label="Low"          value={summary.low}    color={SEVERITY_COLORS.LOW} />
      </div>

      {/* Alert Feed */}
      <section style={styles.feed}>
        <h2 style={styles.feedTitle}>Live Alert Feed</h2>
        {alerts.length === 0 ? (
          <p style={styles.empty}>No alerts detected yet. Listening...</p>
        ) : (
          alerts.map((alert, i) => (
            <AlertRow key={alert.id ?? i} alert={alert} />
          ))
        )}
      </section>

    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────
// TODO (Person 3): move these into separate files inside src/components/

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ ...styles.card, borderTop: ⁠ 4px solid ${color} ⁠ }}>
      <span style={styles.cardValue}>{value}</span>
      <span style={styles.cardLabel}>{label}</span>
    </div>
  )
}

function AlertRow({ alert }) {
  const color = SEVERITY_COLORS[alert.severity] || '#fff'
  return (
    <div style={{ ...styles.alertRow, borderLeft: ⁠ 4px solid ${color} ⁠ }}>
      <span style={{ ...styles.severity, color }}>{alert.severity}</span>
      <span style={styles.alertType}>{alert.type}</span>
      <span style={styles.alertMeta}>{alert.src_ip} → {alert.dst_ip}</span>
      <span style={styles.alertTime}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
// TODO (Person 3): replace these inline styles with a proper CSS file or Tailwind
const styles = {
  app:        { background: '#0f172a', minHeight: '100vh', color: '#f1f5f9', fontFamily: 'monospace', padding: '0 0 40px' },
  header:     { display: 'flex', alignItems: 'center', gap: 16, padding: '24px 32px', borderBottom: '1px solid #1e293b' },
  title:      { margin: 0, fontSize: 24, color: '#f1f5f9' },
  badge:      { padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 'bold', color: '#fff' },
  cards:      { display: 'flex', gap: 16, padding: '24px 32px' },
  card:       { flex: 1, background: '#1e293b', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 },
  cardValue:  { fontSize: 32, fontWeight: 'bold' },
  cardLabel:  { fontSize: 13, color: '#94a3b8' },
  feed:       { padding: '0 32px' },
  feedTitle:  { fontSize: 16, color: '#94a3b8', marginBottom: 12 },
  empty:      { color: '#475569', fontStyle: 'italic' },
  alertRow:   { display: 'flex', gap: 16, alignItems: 'center', background: '#1e293b', borderRadius: 6, padding: '12px 16px', marginBottom: 8 },
  severity:   { fontWeight: 'bold', width: 60, fontSize: 13 },
  alertType:  { flex: 1, fontSize: 14 },
  alertMeta:  { color: '#94a3b8', fontSize: 13 },
  alertTime:  { color: '#475569', fontSize: 12 },
}
