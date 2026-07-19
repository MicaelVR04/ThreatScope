import { useEffect, useState } from 'react'
import { threatLabel, threatPlainEnglish } from '../utils/threatLabels'

const SEV_DOT_CLASS = { HIGH: 'bg-severity-high', MEDIUM: 'bg-severity-medium', LOW: 'bg-severity-low' }

// Ties bar to strictly frequency, since mixing severity-segments into the
// same bar length made it read as two different metrics stacked together.
// Dominant severity is surfaced separately as a single dot instead.
function dominantSeverity(high, medium, low) {
  if (high >= medium && high >= low) return 'HIGH'
  if (medium >= low) return 'MEDIUM'
  return 'LOW'
}

// Ranked bar list instead of a generic chart-library bar chart — order
// carries real information here (which attack type is most frequent), so a
// rank badge earns its place. Each row's bar grows in on a stagger (same
// technique as the Attack Surface heat strip, just cascaded), and the #1
// row gets a slow ambient glow since it's the one row whose state ("most
// frequent right now") is worth a continuous signal.
function TypeRow({ rank, type, high, medium, low, total, maxTotal, delayMs, isTop }) {
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setGrown(true), delayMs)
    return () => clearTimeout(id)
  }, [delayMs])

  const barWidthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
  const dominant = dominantSeverity(high, medium, low)

  return (
    <div
      className="group -mx-2 flex animate-fade-up items-center gap-3 rounded-lg px-2 py-2 transition-all duration-200 ease-swift hover:translate-x-0.5 hover:bg-white/[0.04]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-surface-2 font-mono text-[10px] text-ink-faint">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEV_DOT_CLASS[dominant]}`} />
            <span className="truncate text-[12.5px] font-medium text-ink" title={threatPlainEnglish(type)}>
              {threatLabel(type)}
            </span>
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">{total}</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full bg-signal transition-[width] duration-[900ms] ease-swift group-hover:shadow-[0_0_10px_rgba(46,235,209,0.55)] ${isTop ? 'animate-bar-glow' : ''}`}
            style={{ width: grown ? `${barWidthPct}%` : '0%' }}
          />
          <div
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_6px_rgba(46,235,209,0.8)] transition-[left] duration-[900ms] ease-swift"
            style={{ left: grown ? `calc(${barWidthPct}% - 4px)` : '-4px' }}
          />
        </div>
      </div>
    </div>
  )
}

export default function AttackTypeChart({ data = [] }) {
  if (!data.length) {
    return <div className="py-[60px] text-center italic text-ink-faint">No attack type data yet.</div>
  }

  const sorted = [...data]
    .map(d => ({ ...d, total: (d.HIGH || 0) + (d.MEDIUM || 0) + (d.LOW || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  const maxTotal = Math.max(1, ...sorted.map(d => d.total))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-high" /> High</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-medium" /> Medium</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-severity-low" /> Low</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {sorted.map((d, i) => (
          <TypeRow
            key={d.type}
            rank={i + 1}
            type={d.type}
            high={d.HIGH || 0}
            medium={d.MEDIUM || 0}
            low={d.LOW || 0}
            total={d.total}
            maxTotal={maxTotal}
            delayMs={i * 70}
            isTop={i === 0}
          />
        ))}
      </div>
    </div>
  )
}
