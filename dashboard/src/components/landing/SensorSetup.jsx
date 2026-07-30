import {
  CheckCircle2,
  Download,
  KeyRound,
  Laptop,
  Monitor,
  Router,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import useReveal from '../../hooks/landing/useReveal'

const SETUP_STEPS = [
  {
    n: '01',
    Icon: Download,
    title: 'Install once',
    body: 'The network owner installs the sensor on the Mac or Windows computer that will monitor traffic. Regular dashboard users do not install it.',
  },
  {
    n: '02',
    Icon: KeyRound,
    title: 'Approve access',
    body: 'macOS and Windows ask for administrator approval because reading network packets requires protected system access.',
  },
  {
    n: '03',
    Icon: CheckCircle2,
    title: 'Confirm it is online',
    body: 'The sensor starts automatically, reconnects after a restart, and reports its status directly in the dashboard.',
  },
]

export default function SensorSetup() {
  const [ref, visible] = useReveal()

  return (
    <section id="sensor-setup" className="scroll-mt-20 border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
              Sensor setup
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
              One sensor protects one network location.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-muted">
              ThreatScope needs a small background service wherever traffic is monitored.
              Install it once on a gateway, an always-on monitoring computer, or each
              endpoint that needs its own protection.
            </p>

            <div className="mt-8 border-l-2 border-signal/50 pl-5">
              <div className="flex items-center gap-2 text-ink">
                <ShieldCheck size={18} className="text-signal" />
                <p className="font-display text-sm font-semibold">No Terminal required</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Download the setup package for your computer, paste a one-time code, and approve normal administrator access.
                Monitoring, assessments, and access removal stay in the dashboard.
              </p>
            </div>
          </div>

          <div ref={ref} className="border-t border-white/[0.1]">
            {SETUP_STEPS.map(({ n, Icon, title, body }, index) => (
              <div
                key={n}
                className={`grid grid-cols-[auto_1fr] gap-4 border-b border-white/[0.1] py-6 transition-all duration-300 ease-swift ${
                  visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                }`}
                style={{ transitionDelay: visible ? `${index * 70}ms` : '0ms' }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-signal/30 bg-signal-dim">
                  <Icon size={17} className="text-signal" />
                </div>
                <div>
                  <p className="font-mono text-[11px] text-ink-faint">{n}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 border-y border-white/[0.1] py-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-3xl items-start gap-4">
              <Laptop size={20} className="mt-0.5 shrink-0 text-signal" />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-base font-semibold text-ink">Current preview: macOS</h3>
                  <span className="rounded-full border border-severity-medium/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-severity-medium">Project preview</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  The project build uses a graphical installer and secure one-time enrollment codes. Because it is not Apple-notarized, macOS may require one Open Anyway approval in Privacy &amp; Security on first launch.
                </p>
              </div>
            </div>
            <Link
              to="/sensor-setup"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-signal/35 px-5 py-2.5 font-display text-sm font-semibold text-signal transition-colors duration-150 ease-swift hover:bg-signal-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              <Router size={16} />
              View setup guide
            </Link>
          </div>
          <div className="mt-7 flex max-w-3xl items-start gap-4 border-t border-white/[0.1] pt-7">
            <Monitor size={20} className="mt-0.5 shrink-0 text-signal" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-base font-semibold text-ink">Current preview: Windows</h3>
                <span className="rounded-full border border-severity-medium/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-severity-medium">Project preview</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Windows 10 and 11 setup runs from a guided window after extracting the download. It uses a one-time enrollment code and needs <a href="https://www.python.org/downloads/windows/" target="_blank" rel="noreferrer" className="font-semibold text-signal hover:text-signal/80">Python 3.11</a>, <a href="https://npcap.com/dist/" target="_blank" rel="noreferrer" className="font-semibold text-signal hover:text-signal/80">Npcap</a>, and the standard Windows administrator prompt. Windows security should remain enabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
