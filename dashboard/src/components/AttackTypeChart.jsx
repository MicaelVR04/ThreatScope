import { useEffect, useRef, useState } from 'react'
import { threatLabel, threatPlainEnglish } from '../utils/threatLabels'

// Same glyph set as AlertCard's severity indicator — shape-differentiated,
// not just color, so this reads correctly for colorblind users too (a plain
// same-shaped dot recolored per severity was color-only, which fails the
// "don't convey meaning through color alone" rule the ui-ux-pro-max audit
// flagged here).
const SEV_GLYPH = { HIGH: '▲', MEDIUM: '▶', LOW: '•' }
const SEV_TEXT_CLASS = { HIGH: 'text-severity-high', MEDIUM: 'text-severity-medium', LOW: 'text-severity-low' }

// Tuned to the "Standard" stagger-list tier (400-600ms, ~60ms/item) rather
// than the slower 900ms/70ms this used before — long entrance timing on a
// short list reads as sluggish, not "alive."
const GROW_MS = 550
const STAGGER_MS = 55

// Ties bar to strictly frequency, since mixing severity-segments into the
// same bar length made it read as two different metrics stacked together.
// Dominant severity is surfaced separately as a single dot instead.
function dominantSeverity(high, medium, low) {
  if (high >= medium && high >= low) return 'HIGH'
  if (medium >= low) return 'MEDIUM'
  return 'LOW'
}

// Counts a row's total up in step with its bar growing, so the number
// itself reads as live data animating rather than static decoration. The
// dashboard's WebSocket feed keeps refreshing this data every few seconds
// (new alerts arrive → typeStats refetches), so `target` changes repeatedly
// over the component's lifetime, not just once on mount — the *first* run
// counts up from 0 with the entrance stagger; every run after that counts
// smoothly from whatever's currently on screen to the new total, instantly
// and a little faster, since it's reacting to something that just happened
// rather than introducing the row for the first time. Skips straight to the
// final value under reduced motion.
function useCountUp(target, delayMs, active) {
  const [value, setValue] = useState(active ? 0 : target)
  const valueRef = useRef(value)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    if (!active) { setValue(target); valueRef.current = target; return }
    const firstRun = !hasMountedRef.current
    hasMountedRef.current = true
    const from = firstRun ? 0 : valueRef.current
    const duration = firstRun ? GROW_MS : 500
    let raf
    const startTimer = setTimeout(() => {
      const start = performance.now()
      const tick = now => {
        const p = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        const next = Math.round(from + (target - from) * eased)
        valueRef.current = next
        setValue(next)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, firstRun ? delayMs : 0)
    return () => {
      clearTimeout(startTimer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [target, delayMs, active])

  return value
}

// Ranked bar list instead of a generic chart-library bar chart — order
// carries real information here (which attack type is most frequent), so a
// rank badge earns its place. Each row's bar grows in on a stagger (same
// technique as the Attack Surface heat strip, just cascaded), its count
// ticks up in sync, and the #1 row gets a slow ambient glow since it's the
// one row whose state ("most frequent right now") is worth a continuous
// signal — every other row stays still until hovered.
function TypeRow({ rank, type, high, medium, low, total, maxTotal, delayMs, isTop, reduceMotion }) {
  const [grown, setGrown] = useState(reduceMotion)

  useEffect(() => {
    if (reduceMotion) { setGrown(true); return }
    const id = setTimeout(() => setGrown(true), delayMs)
    return () => clearTimeout(id)
  }, [delayMs, reduceMotion])

  const displayTotal = useCountUp(total, delayMs, !reduceMotion)
  const barWidthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
  const dominant = dominantSeverity(high, medium, low)

  return (
    <div
      className="group -mx-2 flex animate-fade-up items-center gap-3 rounded-lg px-2 py-2 transition-all duration-200 ease-swift hover:translate-x-0.5 hover:bg-white/[0.04] motion-reduce:animate-none"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-surface-2 font-mono text-[10px] text-ink-faint">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`w-2.5 shrink-0 text-[10px] leading-none ${SEV_TEXT_CLASS[dominant]}`} title={`Dominant severity: ${dominant}`}>
              {SEV_GLYPH[dominant]}
            </span>
            <span className="min-w-0" title={threatPlainEnglish(type)}>
              <span className="block truncate font-mono text-[12px] font-semibold text-ink">{type}</span>
              <span className="block truncate text-[10px] text-ink-faint">{threatLabel(type)}</span>
            </span>
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">{displayTotal}</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full bg-signal transition-[width] ease-swift group-hover:shadow-[0_0_10px_rgba(46,235,209,0.55)] motion-reduce:animate-none ${isTop ? 'animate-bar-glow' : ''}`}
            style={{ width: grown ? `${barWidthPct}%` : '0%', transitionDuration: `${GROW_MS}ms` }}
          />
          <div
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_6px_rgba(46,235,209,0.8)] transition-[left] ease-swift"
            style={{ left: grown ? `calc(${barWidthPct}% - 4px)` : '-4px', transitionDuration: `${GROW_MS}ms` }}
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

  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
            delayMs={i * STAGGER_MS}
            isTop={i === 0}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </div>
  )
}
