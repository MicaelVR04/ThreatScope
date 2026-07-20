import { Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

const LINKS = [
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#sensor-setup', label: 'Sensor Setup' },
  { href: '#stack', label: 'Stack' },
]

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base'

export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <a href="#top" className={`flex items-center gap-2 rounded-sm ${FOCUS_RING}`}>
          <Shield size={20} className="text-signal" strokeWidth={2.25} />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            ThreatScope
          </span>
        </a>

        <nav className="hidden flex-1 items-center gap-7 md:flex">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={`group relative cursor-pointer rounded-sm font-mono text-[13px] uppercase tracking-wide text-ink-muted transition-colors duration-150 ease-swift hover:text-signal ${FOCUS_RING}`}
            >
              {label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-signal transition-transform duration-200 ease-swift group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 rounded-full border border-signal/25 bg-signal-dim px-3 py-1 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-signal" />
          </span>
          <span className="font-mono text-[11px] font-medium tracking-wide text-signal">
            LIVE SYSTEM
          </span>
        </div>

        <Link
          to="/login"
          className={`inline-flex shrink-0 cursor-pointer items-center rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold text-base transition-all duration-150 ease-swift hover:scale-[1.02] hover:shadow-[0_0_24px_-4px_rgba(46,235,209,0.6)] active:scale-[0.97] ${FOCUS_RING}`}
        >
          <span className="sm:hidden">Launch</span>
          <span className="hidden sm:inline">Launch Dashboard</span>
        </Link>
      </div>
    </header>
  )
}
