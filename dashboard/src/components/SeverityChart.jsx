import { PieChart, Pie, Cell, Label, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const SLICES = [
  { key: 'high',   label: 'HIGH',   color: '#ef4444' },
  { key: 'medium', label: 'MEDIUM', color: '#f59e0b' },
  { key: 'low',    label: 'LOW',    color: '#22c55e' },
]

function CenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox
  return (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#f1f5f9" fontSize={28} fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={12}>
        total
      </text>
    </>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={styles.tooltip}>
      <span style={{ fontWeight: 600 }}>{name}</span>: {value}
    </div>
  )
}

function CustomLegend({ payload }) {
  return (
    <div style={styles.legend}>
      {payload.map(({ value, color }) => (
        <span key={value} style={styles.legendItem}>
          <span style={{ ...styles.legendDot, background: color }} />
          {value}
        </span>
      ))}
    </div>
  )
}

export default function SeverityChart({ data }) {
  const chartData = SLICES
    .map(s => ({ name: s.label, value: data?.[s.key] ?? 0, color: s.color }))
    .filter(s => s.value > 0)

  const total = chartData.reduce((sum, s) => sum + s.value, 0)

  if (!total) {
    return <div style={styles.empty}>No severity data yet.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map(({ name, color }) => (
            <Cell key={name} fill={color} stroke="transparent" />
          ))}
          <Label content={<CenterLabel total={total} />} position="center" />
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

const styles = {
  tooltip:    { background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '6px 12px', fontSize: 13, color: '#f1f5f9' },
  legend:     { display: 'flex', justifyContent: 'center', gap: 20, marginTop: 4 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  legendDot:  { width: 8, height: 8, borderRadius: '50%' },
  empty:      { textAlign: 'center', color: '#475569', fontStyle: 'italic', padding: '60px 0' },
}
