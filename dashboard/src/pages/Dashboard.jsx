import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import AlertCard from '../components/AlertCard'
import useWebSocket from '../hooks/useWebSocket'
import { getAlertsSummary } from '../services/api'
import { useEffect } from 'react'

const SEVERITY_COLORS = {
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#22c55e',
}

export default function Dashboard({ onConnectionChange }) {
  const { alerts, connected } = useWebSocket()
  const [summary, setSummary] = useState({ total: 0, high: 0, medium: 0, low: 0 })

  useEffect(() => {
    onConnectionChange?.(connected)
  }, [connected, onConnectionChange])

  useEffect(() => {
    getAlertsSummary().then(setSummary).catch(console.error)
  }, [])

  // Build chart data from last 10 alerts
  const chartData = alerts.slice(0, 10).reverse().map((a, i) => ({
    name: `#${i + 1}`,
    HIGH:   a.severity === 'HIGH'   ? 1 : 0,
    MEDIUM: a.severity === 'MEDIUM' ? 1 : 0,
    LOW:    a.severity === 'LOW'    ? 1 : 0,
  }))

  return (
    <main style={styles.main}>

      {/* Summary cards */}
      <div style={styles.cards}>
        {[
          { label: 'Total Alerts', value: summary.total, color: '#6366f1' },
          { label: 'High',         value: summary.high,   color: SEVERITY_COLORS.HIGH },
          { label: 'Medium',       value: summary.medium, color: SEVERITY_COLORS.MEDIUM },
          { label: 'Low',          value: summary.low,    color: SEVERITY_COLORS.LOW },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
            <span style={styles.cardValue}>{value}</span>
            <span style={styles.cardLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Traffic chart */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Alert Activity</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#475569" />
            <YAxis stroke="#475569" allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
            <Area type="monotone" dataKey="HIGH"   stroke={SEVERITY_COLORS.HIGH}   fill={SEVERITY_COLORS.HIGH}   fillOpacity={0.15} />
            <Area type="monotone" dataKey="MEDIUM" stroke={SEVERITY_COLORS.MEDIUM} fill={SEVERITY_COLORS.MEDIUM} fillOpacity={0.15} />
            <Area type="monotone" dataKey="LOW"    stroke={SEVERITY_COLORS.LOW}    fill={SEVERITY_COLORS.LOW}    fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      {/* Live alert feed */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Live Alert Feed</h2>
        {alerts.length === 0
          ? <p style={styles.empty}>No alerts detected yet. Listening...</p>
          : alerts.map((alert, i) => <AlertCard key={alert.id ?? i} alert={alert} />)
        }
      </section>

    </main>
  )
}

const styles = {
  main:         { padding: '24px 32px' },
  cards:        { display: 'flex', gap: 16, marginBottom: 32 },
  card:         { flex: 1, background: '#1e293b', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 },
  cardValue:    { fontSize: 32, fontWeight: 'bold', color: '#f1f5f9' },
  cardLabel:    { fontSize: 13, color: '#94a3b8' },
  section:      { marginBottom: 32 },
  sectionTitle: { fontSize: 15, color: '#94a3b8', marginBottom: 12 },
  empty:        { color: '#475569', fontStyle: 'italic' },
}
