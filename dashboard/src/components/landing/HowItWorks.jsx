import { Antenna, ScanSearch, Tags, BellRing, LayoutDashboard } from 'lucide-react'
import useReveal from '../../hooks/landing/useReveal'

const STEPS = [
  { n: '01', Icon: Antenna, title: 'Capture', body: 'The Scapy engine sniffs raw packets straight off the network interface.' },
  { n: '02', Icon: ScanSearch, title: 'Analyze', body: 'Each packet is checked against a library of rule-based attack signatures.' },
  { n: '03', Icon: Tags, title: 'Classify', body: 'Matches are scored and tagged HIGH, MEDIUM, or LOW severity.' },
  { n: '04', Icon: BellRing, title: 'Alert', body: "The moment a match fires, it's pushed live over WebSocket — no refresh needed." },
  { n: '05', Icon: LayoutDashboard, title: 'Visualize', body: 'Alerts land in the dashboard as live cards, charts, and a searchable history.' },
]

export default function HowItWorks() {
  const [ref, visible] = useReveal()

  return (
    <section id="how-it-works" className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            How it works
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
            One pipeline, from packet to alert.
          </h2>
        </div>

        <div ref={ref} className="relative mt-16">
          <div
            className="absolute left-0 top-6 hidden h-px origin-left bg-white/10 transition-transform duration-300 ease-swift md:block"
            style={{
              width: 'calc(100% - 3rem)',
              transform: visible ? 'scaleX(1)' : 'scaleX(0)',
            }}
          />
          {/* A signal traveling along the pipeline once the line is drawn —
              purely decorative, so it's hidden from the a11y tree. Height
              must be real (not h-px like the line itself): a radial-gradient
              painted inside a 1px-tall box has no vertical room to render as
              a visible glow — it was previously invisible for exactly this
              reason, not because the animation wasn't running. */}
          <div
            aria-hidden="true"
            className={`absolute left-0 top-6 hidden h-3 -translate-y-1/2 bg-[length:32px_12px] bg-no-repeat [background-image:radial-gradient(circle,theme(colors.signal.DEFAULT)_0%,transparent_70%)] md:block ${
              visible ? 'animate-pipeline-pulse' : 'opacity-0'
            }`}
            style={{ width: 'calc(100% - 3rem)' }}
          />

          <div className="grid gap-10 md:grid-cols-5 md:gap-6">
            {STEPS.map(({ n, Icon, title, body }, i) => (
              <div
                key={n}
                className={`relative transition-all duration-300 ease-swift ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
                style={{ transitionDelay: visible ? `${100 + i * 80}ms` : '0ms' }}
              >
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-signal/30 bg-base">
                  <Icon size={18} className="text-signal" strokeWidth={2} />
                </div>
                <p className="mt-4 font-mono text-xs text-ink-faint">{n}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
