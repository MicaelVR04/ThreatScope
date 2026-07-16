import { Shield, GitFork } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-signal" />
          <span className="font-display text-sm font-semibold text-ink">ThreatScope</span>
          <span className="hidden text-ink-faint md:inline">·</span>
          <span className="hidden font-mono text-xs text-ink-faint md:inline">
            Real-time network intrusion detection
          </span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="#capabilities"
            className="cursor-pointer rounded-sm font-mono text-xs text-ink-muted transition-colors duration-150 ease-swift hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            Capabilities
          </a>
          <a
            href="https://github.com/MicaelVR04/ThreatScope"
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer rounded-sm text-ink-muted transition-colors duration-150 ease-swift hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            aria-label="GitHub repository"
          >
            <GitFork size={16} />
          </a>
        </div>
      </div>

      <p className="mt-6 text-center font-mono text-[11px] text-ink-faint">
        Built for Holberton School Demo Day.
      </p>
    </footer>
  )
}
