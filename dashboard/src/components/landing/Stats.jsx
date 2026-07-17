import { useEffect, useState } from 'react'
import useReveal from '../../hooks/useReveal'

const BADGES = ['Python', 'Scapy', 'FastAPI', 'WebSocket', 'React', 'Recharts']

const TILES = [
  { value: 3, suffix: '', label: 'Severity tiers — HIGH, MEDIUM, LOW' },
  { value: null, display: '0ms', label: 'Polling delay — alerts push live over WebSocket' },
  { value: null, display: '∞', label: 'Alert history — fully logged and searchable' },
]

// Number ticker: counts up only when the tile becomes visible, and only for
// numeric targets — symbolic values (∞, "0ms") render as-is, no fake count.
function StatValue({ value, suffix, display, visible }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!visible || value == null) return
    const duration = 300
    const start = performance.now()

    let frame
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      setCount(Math.round(progress * value))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visible, value])

  if (value == null) {
    return (
      <span
        className={`inline-block font-mono transition-all duration-300 ease-swift ${
          visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {display}
      </span>
    )
  }

  return (
    <span className="font-mono tabular-nums">
      {count}
      {suffix}
    </span>
  )
}

export default function Stats() {
  const [ref, visible] = useReveal()

  return (
    <section id="stack" className="border-t border-white/[0.06] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            Stack
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
            Built on a real detection pipeline, not a mockup.
          </h2>
        </div>

        <div ref={ref} className="mt-10 flex flex-wrap gap-2.5">
          {BADGES.map((badge, i) => (
            <span
              key={badge}
              className={`cursor-default rounded-full border border-white/[0.08] bg-surface px-3.5 py-1.5 font-mono text-xs text-ink-muted transition-all duration-200 ease-swift hover:scale-105 hover:border-signal/40 hover:bg-surface-2 hover:text-signal ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ transitionDelay: visible ? `${i * 40}ms` : '0ms' }}
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {TILES.map(({ value, suffix, display, label }, i) => (
            <div
              key={label}
              className={`rounded-xl border border-white/[0.08] bg-surface p-7 transition-all duration-300 ease-swift ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: visible ? `${240 + i * 90}ms` : '0ms' }}
            >
              <p className="text-4xl font-semibold text-signal">
                <StatValue value={value} suffix={suffix} display={display} visible={visible} />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
