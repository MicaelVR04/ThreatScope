import { useEffect, useRef, useState } from 'react'
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
    wash: 'bg-severity-high/[0.07]',
    text: 'text-severity-high',
  },
  {
    sev: 'MEDIUM',
    label: 'Unusual Outbound Traffic',
    ip: '10.0.0.18',
    Icon: AlertTriangle,
    wash: 'bg-severity-medium/[0.07]',
    text: 'text-severity-medium',
  },
  {
    sev: 'LOW',
    label: 'Repeated Auth Attempt',
    ip: '172.16.4.9',
    Icon: Info,
    wash: 'bg-severity-low/[0.07]',
    text: 'text-severity-low',
  },
]

// Angle (clockwise from top, matching the conic-gradient's own coordinate
// system) and radius (fraction of the radar's own radius, 0-0.5) for each
// detection ping. Positioned via top/left percentages — not transform:
// translate, which is relative to the dot's own size, not the radar's —
// so they scale automatically with the radar at every breakpoint with no
// extra responsive logic needed.
const RADAR_DOTS = [
  { angle: 40, radius: 0.36 },
  { angle: 145, radius: 0.22 },
  { angle: 235, radius: 0.44 },
  { angle: 320, radius: 0.3 },
]

function radarDotStyle({ angle, radius }) {
  const rad = (angle * Math.PI) / 180
  const left = 50 + radius * 50 * Math.sin(rad)
  const top = 50 - radius * 50 * Math.cos(rad)
  // The sweep's brightest edge sits 18deg into its wedge (see the
  // conic-gradient below), so a ping at `angle` lights up when the sweep's
  // rotation has carried that edge to the same angle — approximated here
  // rather than solved exactly, since a ~100ms timing error is imperceptible
  // in a flash this brief.
  const delaySeconds = (((angle - 18 + 360) % 360) / 360) * 6
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `-${delaySeconds}s`,
  }
}

// Subtle scroll-tied drift on the radar sweep and telemetry panel — skipped
// entirely under prefers-reduced-motion rather than just running slower.
function useParallax(factor) {
  const ref = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return

    let frame
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.transform = `translateY(${window.scrollY * factor}px)`
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [factor])

  return ref
}

export default function Hero() {
  const [headlineIn, setHeadlineIn] = useState(false)
  const radarRef = useParallax(0.06)
  const panelRef = useParallax(-0.03)

  useEffect(() => {
    setHeadlineIn(true)
  }, [])

  return (
    <section id="top" className="relative overflow-hidden pt-24 pb-28 md:pt-32 md:pb-36">
      {/* Radar sweep — decorative, GPU-composited (transform only), hidden from a11y tree.
          Sized per breakpoint rather than a single fixed 640px: at a half-width
          browser window 640px reads fine against the hero's narrower column, but
          at full width the hero column is much wider and the same 640px starts
          to look small and lost in the corner. md stays untouched — that size
          was already confirmed correct. lg/xl/2xl land between the original
          640px (too small at full width) and a prior pass at 1120px (too big,
          and positioned too far right/down) — smaller than that attempt and
          shifted left/up (more right-inset, more negative top) from it. */}
      <div
        ref={radarRef}
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-[640px] w-[640px] opacity-[0.18] md:-right-10 lg:-right-6 lg:-top-24 lg:h-[720px] lg:w-[720px] xl:right-4 xl:-top-12 xl:h-[820px] xl:w-[820px] 2xl:right-16 2xl:-top-8 2xl:h-[900px] 2xl:w-[900px]"
      >
        <div className="h-full w-full animate-radar-sweep rounded-full [background:conic-gradient(from_0deg,transparent_0deg,theme(colors.signal.DEFAULT)_18deg,transparent_60deg)]" />
        <div className="absolute inset-0 rounded-full border border-signal/20" />
        <div className="absolute inset-12 rounded-full border border-signal/10" />
        <div className="absolute inset-24 rounded-full border border-signal/10" />

        {/* Detection pings — brief flashes timed to when the sweep's leading
            edge passes each dot's position, so it reads as "detecting"
            rather than decorative. animation-duration matches the sweep's
            own 6s rotation so each ping repeats in sync every cycle. */}
        {RADAR_DOTS.map((dot, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 animate-radar-ping rounded-full bg-signal"
            style={radarDotStyle(dot)}
          />
        ))}
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
        <div>
          <p
            className={`font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal transition-all duration-300 ease-swift ${
              headlineIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            Real-time network intrusion detection
          </p>

          <h1 className="mt-5 text-balance font-display text-5xl font-bold leading-[1.05] tracking-[-0.02em] text-ink md:text-7xl">
            <span
              className={`block transition-all duration-300 ease-swift ${
                headlineIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '80ms' }}
            >
              Nothing moves on your network
            </span>
            <span
              className={`block text-signal transition-all duration-300 ease-swift ${
                headlineIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '180ms' }}
            >
              unseen.
            </span>
          </h1>

          <p
            className={`mt-6 max-w-xl text-lg leading-relaxed text-ink-muted transition-all duration-300 ease-swift ${
              headlineIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
            style={{ transitionDelay: '260ms' }}
          >
            ThreatScope captures live traffic, matches it against known attack
            signatures, and streams every threat to your dashboard the instant
            it's detected — severity-classified, in real time.
          </p>

          <div
            className={`mt-9 flex flex-wrap items-center gap-4 transition-all duration-300 ease-swift ${
              headlineIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
            style={{ transitionDelay: '320ms' }}
          >
            <Link
              to="/dashboard"
              className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-signal px-6 py-3 font-display text-sm font-semibold text-base transition-all duration-150 ease-swift hover:scale-[1.02] hover:shadow-[0_0_28px_-4px_rgba(46,235,209,0.65)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
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
          ref={panelRef}
          className="animate-fade-up rounded-xl bg-surface p-5 shadow-[0_0_60px_-20px_rgba(46,235,209,0.2)] md:mt-10"
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
            {DEMO_FEED.map(({ sev, label, ip, Icon, wash, text }, i) => (
              <li
                key={sev}
                className={`animate-fade-up flex items-center gap-3 rounded-lg px-3 py-2.5 ${wash}`}
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
