import {
  Radar, ShieldCheck, GaugeCircle, Zap, PieChart, History,
} from 'lucide-react'
import useReveal from '../../hooks/useReveal'

const ITEMS = [
  {
    Icon: Radar,
    title: 'Live Packet Capture',
    body: "A Scapy-powered engine inspects traffic as it crosses the wire — not after the fact.",
  },
  {
    Icon: ShieldCheck,
    title: 'Rule-Based Signature Detection',
    body: 'Known attack patterns are matched against live traffic in real time.',
  },
  {
    Icon: GaugeCircle,
    title: 'Severity Classification',
    body: 'Every alert is triaged HIGH, MEDIUM, or LOW so you know what to act on first.',
  },
  {
    Icon: Zap,
    title: 'Real-Time WebSocket Feed',
    body: 'Alerts reach the dashboard the instant they fire — no polling, no delay.',
  },
  {
    Icon: PieChart,
    title: 'Attack-Type Analytics',
    body: "A live breakdown of what's hitting your network, and how often.",
  },
  {
    Icon: History,
    title: 'Full Alert History',
    body: 'Nothing gets lost. Every alert is logged and searchable after the fact.',
  },
]

export default function Capabilities() {
  const [ref, visible] = useReveal()

  return (
    <section id="capabilities" className="border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            Capabilities
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
            Built to catch what others miss.
          </h2>
          <p className="mt-4 text-lg text-ink-muted">
            Six things happen between a packet crossing the wire and an alert on your screen.
          </p>
        </div>

        <div ref={ref} className="mt-14 grid gap-x-10 border-t border-white/[0.08] md:grid-cols-2">
          {ITEMS.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className={`group flex items-start gap-4 border-b border-white/[0.08] py-6 transition-all duration-200 ease-swift ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
              style={{ transitionDelay: visible ? `${i * 60}ms` : '0ms' }}
            >
              <Icon
                size={20}
                className="mt-0.5 shrink-0 text-signal transition-transform duration-200 ease-swift group-hover:rotate-6 group-hover:scale-110"
                strokeWidth={1.75}
              />
              <div>
                <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
