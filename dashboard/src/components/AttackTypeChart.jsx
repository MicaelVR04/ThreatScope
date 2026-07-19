import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { threatLabel, threatPlainEnglish } from '../utils/threatLabels'

// Hex-only — Recharts renders its own SVG and needs literal color values,
// same reason Dashboard.jsx's severity colors do. Matches the design-system
// severity tokens exactly.
const SEV_COLORS = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#22C55E' }

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-white/[0.12] bg-surface px-3 py-2.5">
      <p className="mb-0.5 text-[13px] font-semibold text-ink">{threatLabel(label)}</p>
      <p className="mb-1.5 max-w-[240px] text-xs leading-[1.4] text-ink-faint">{threatPlainEnglish(label)}</p>
      {payload.map(({ name, value, color }) => (
        <p key={name} className="text-xs" style={{ color }}>{name}: <strong>{value}</strong></p>
      ))}
    </div>
  )
}

export default function AttackTypeChart({ data = [] }) {
  if (!data.length) {
    return <div className="py-[60px] text-center italic text-ink-faint">No attack type data yet.</div>
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
        <XAxis
          type="number"
          stroke="#707C8C"
          tick={{ fontSize: 11, fill: '#707C8C' }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="type"
          stroke="#707C8C"
          tick={{ fontSize: 11, fill: '#8B96A5' }}
          tickFormatter={threatLabel}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#8B96A5', paddingTop: 8 }}
          formatter={v => <span style={{ color: SEV_COLORS[v] }}>{v}</span>}
        />
        <Bar dataKey="HIGH"   stackId="a" fill={SEV_COLORS.HIGH}   radius={0} />
        <Bar dataKey="MEDIUM" stackId="a" fill={SEV_COLORS.MEDIUM} radius={0} />
        <Bar dataKey="LOW"    stackId="a" fill={SEV_COLORS.LOW}    radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
