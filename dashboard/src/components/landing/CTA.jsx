import { Link } from 'react-router-dom'
import { ArrowRight, GitFork } from 'lucide-react'
import useReveal from '../../hooks/landing/useReveal'

export default function CTA() {
  const [ref, visible] = useReveal()

  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] py-32">
      {/* Ambient drift, matching the hero's idle radar motion — this section
          was otherwise the flattest on the page, zero decorative motion.
          Centering and the float animation are split across two elements:
          a CSS `animation` replaces an element's whole computed transform
          each frame, so it can't share a transform property with the
          static -translate-x/y-1/2 centering on the same element. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="h-full w-full animate-float rounded-full bg-signal/10 blur-3xl" />
      </div>

      <div
        ref={ref}
        className={`mx-auto max-w-3xl px-6 text-center transition-all duration-300 ease-swift ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Your network's next alert is one packet away.
        </h2>
        <p className="mt-4 text-lg text-ink-muted">
          Open the dashboard and watch traffic get analyzed, classified, and flagged live.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-signal px-6 py-3 font-display text-sm font-semibold text-base transition-all duration-150 ease-swift hover:scale-[1.02] hover:shadow-[0_0_28px_-4px_rgba(46,235,209,0.65)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            Launch Dashboard
            <ArrowRight
              size={16}
              className="transition-transform duration-150 ease-swift group-hover:translate-x-0.5"
            />
          </Link>
          <a
            href="https://github.com/MicaelVR04/ThreatScope"
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/[0.12] px-6 py-3 font-mono text-sm text-ink-muted transition-all duration-150 ease-swift hover:border-signal/30 hover:text-signal active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <GitFork size={16} />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
