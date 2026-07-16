import { Link } from 'react-router-dom'
import { ArrowRight, ShieldAlert, AlertTriangle, Info } from 'lucide-react'

// Tailwind's scanner needs full literal class strings — no `border-${color}`
// interpolation — so each severity carries its complete class names.
const DEMO_FEED = [
  {
    sev: 'HIGH',
    label: 'Port Scan Detected',
    ip: '192.168.1.44',
    Icon: ShieldAlert,
    border: 'border-severity-high',
    text: 'text-severity-high',
  },
  {
    sev: 'MEDIUM',
    label: 'Unusual Outbound Traffic',
    ip: '10.0.0.18',
    Icon: AlertTriangle,
    border: 'border-severity-medium',
    text: 'text-severity-medium',
  },
  {
    sev: 'LOW',
    label: 'Repeated Auth Attempt',
    ip: '172.16.4.9',
    Icon: Info,
    border: 'border-severity-low',
    text: 'text-severity-low',
  },
]

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
      {/* Radar sweep — decorative, GPU-composited (transform only), hidden from a11y tree */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] opacity-[0.14] md:-right-20"
      >
        <div className="h-full w-full animate-radar-sweep rounded-full [background:conic-gradient(from_0deg,transparent_0deg,#2EEBD1_18deg,transparent_60deg)]" />
        <div className="absolute inset-0 rounded-full border border-signal/20" />
        <div className="absolute inset-12 rounded-full border border-signal/10" />
        <div className="absolute inset-24 rounded-full border border-signal/10" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="animate-fade-up">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            Real-time network intrusion detection
          </p>

          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink md:text-6xl">
            Nothing moves on
            <br />
            your network <span className="text-signal">unseen.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            ThreatScope captures live traffic, matches it against known attack
            signatures, and streams every threat to your dashboard the instant
            it's detected — severity-classified, in real time.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/dashboard"
              className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-signal px-6 py-3 font-display text-sm font-semibold text-base transition-all duration-150 ease-swift hover:scale-[1.02] hover:shadow-[0_0_28px_-4px_rgba(46,235,209,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              Launch Dashboard
              <ArrowRight
                size={16}
                className="transition-transform duration-150 ease-swift group-hover:translate-x-0.5"
              />
            </Link>
            <a
              href="#how-it-works"
              className="cursor-pointer rounded-sm font-mono text-sm text-ink-muted underline decoration-white/20 underline-offset-4 transition-colors duration-150 ease-swift hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              See how it works
            </a>
          </div>
        </div>

        <div
          className="animate-fade-up rounded-xl border border-white/[0.08] bg-surface p-5 shadow-[0_0_60px_-20px_rgba(46,235,209,0.15)]"
          style={{ animationDelay: '120ms' }}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              live_feed.stream
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-severity-low" />
              <span className="font-mono text-[11px] text-severity-low">connected</span>
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {DEMO_FEED.map(({ sev, label, ip, Icon, border, text }, i) => (
              <li
                key={sev}
                className={`animate-fade-up flex items-center gap-3 rounded-lg border-l-2 bg-surface-2 px-3 py-2.5 ${border}`}
                style={{ animationDelay: `${220 + i * 90}ms` }}
              >
                <Icon size={16} className={`shrink-0 ${text}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{label}</p>
                  <p className="font-mono text-[11px] text-ink-faint">{ip}</p>
                </div>
                <span className={`font-mono text-[10px] font-semibold tracking-wide ${text}`}>
                  {sev}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
