import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const SEV_COLORS = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={styles.tooltip}>
      <p style={styles.tooltipLabel}>{label}</p>
      {payload.map(({ name, value, color }) => (
        <p key={name} style={{ margin: '2px 0', color, fontSize: 12 }}>
          {name}: <strong>{value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function AttackTypeChart({ data = [] }) {
  if (!data.length) {
    return <div style={styles.empty}>No attack type data yet.</div>
  }

  // Sort descending by total count
  const sorted = [...data].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 10)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis
          type="number"
          stroke="#475569"
          tick={{ fontSize: 11 }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="type"
          stroke="#475569"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
          formatter={v => <span style={{ color: SEV_COLORS[v] }}>{v}</span>}
        />
        <Bar dataKey="HIGH"   stackId="a" fill={SEV_COLORS.HIGH}   radius={0} />
        <Bar dataKey="MEDIUM" stackId="a" fill={SEV_COLORS.MEDIUM} radius={0} />
        <Bar dataKey="LOW"    stackId="a" fill={SEV_COLORS.LOW}    radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const styles = {
  tooltip:      { background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px' },
  tooltipLabel: { fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px' },
  empty:        { textAlign: 'center', color: '#475569', fontStyle: 'italic', padding: '60px 0' },
}
