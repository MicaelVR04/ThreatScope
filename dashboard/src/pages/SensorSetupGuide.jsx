import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Power,
  Shield,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const COMMANDS = [
  {
    label: 'Check status',
    command: 'sudo ./scripts/control_sensor_macos.sh status',
    detail: 'Shows whether the background service is loaded and running.',
  },
  {
    label: 'Stop until the next restart',
    command: 'sudo ./scripts/control_sensor_macos.sh stop',
    detail: 'Stops the service now. macOS may load it again after the computer restarts.',
  },
  {
    label: 'Disable until you re-enable it',
    command: 'sudo ./scripts/control_sensor_macos.sh disable',
    detail: 'Stops the service and prevents automatic startup after a restart.',
  },
  {
    label: 'Enable and start',
    command: 'sudo ./scripts/control_sensor_macos.sh enable',
    detail: 'Allows automatic startup again and immediately starts the service.',
  },
  {
    label: 'Remove completely',
    command: 'sudo ./scripts/uninstall_sensor_macos.sh',
    detail: 'Stops ThreatScope and removes its macOS background-service registration.',
  },
]

export default function SensorSetupGuide() {
  return (
    <div className="min-h-screen bg-base font-sans text-ink">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-base/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-sm font-display text-sm font-semibold text-ink transition-colors hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <ArrowLeft size={17} />
            Back
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Shield size={18} className="text-signal" />
            <span className="font-display font-semibold">ThreatScope</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          macOS developer preview
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold text-ink md:text-6xl">
          Install and control the network sensor.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-muted">
          The sensor is required only on a computer or gateway that monitors
          network traffic. People who only sign in to view the dashboard do not
          install it.
        </p>

        <section className="mt-14 border-y border-white/[0.1] py-8">
          <div className="grid gap-8 md:grid-cols-3">
            <GuideFact
              Icon={Eye}
              title="Visible and accountable"
              body="It runs as a normal macOS background process. You can see its Python process in Activity Monitor and inspect its service status and logs."
            />
            <GuideFact
              Icon={ShieldCheck}
              title="No raw packet storage"
              body="Packets are inspected in memory. ThreatScope sends compact alerts and sensor health information, not copies of every packet."
            />
            <GuideFact
              Icon={Power}
              title="You stay in control"
              body="Pause capture from the dashboard, stop or disable the service in macOS, or uninstall it completely at any time."
            />
          </div>
        </section>

        <section className="py-14">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-signal" />
            <h2 className="font-display text-2xl font-semibold">Install once</h2>
          </div>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-muted">
            Download the project, create its <code className="font-mono text-signal">.env</code> file,
            and add the dashboard&apos;s API URL and sensor key. Then open Terminal
            in the ThreatScope project directory and run:
          </p>
          <CommandBlock command="./scripts/setup_sensor_macos.sh" />
          <div className="mt-6 flex items-start gap-3 border-l-2 border-signal/50 pl-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-signal" />
            <p className="text-sm leading-relaxed text-ink-muted">
              macOS requests an administrator password because packet capture is
              protected system access. The setup command creates the required
              Python environment, installs dependencies, and registers the service.
              After installation, close Terminal and
              confirm that the dashboard shows <strong className="text-ink">Sensor: online</strong>.
            </p>
          </div>
        </section>

        <section className="border-t border-white/[0.1] py-14">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-signal" />
            <h2 className="font-display text-2xl font-semibold">Control the service</h2>
          </div>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-muted">
            The dashboard&apos;s <strong className="text-ink">Stop monitoring</strong> button
            pauses packet inspection while leaving the lightweight service online.
            The commands below control the entire macOS service.
          </p>

          <div className="mt-8 border-t border-white/[0.1]">
            {COMMANDS.map(({ label, command, detail }) => (
              <div key={command} className="border-b border-white/[0.1] py-6">
                <h3 className="font-display text-base font-semibold">{label}</h3>
                <p className="mt-1 text-sm text-ink-muted">{detail}</p>
                <CommandBlock command={command} compact />
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/[0.1] py-14">
          <h2 className="font-display text-2xl font-semibold">What “no threats detected” means</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-muted">
            A completed assessment means the sensor inspected the displayed packet
            count and none matched ThreatScope&apos;s currently enabled rules for port
            scans, ping sweeps, SYN floods, or ARP spoofing. It does not prove that
            the entire network is free from every possible attack.
          </p>
        </section>
      </main>
    </div>
  )
}

function GuideFact({ Icon, title, body }) {
  return (
    <div>
      <Icon size={20} className="text-signal" />
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  )
}

function CommandBlock({ command, compact = false }) {
  return (
    <pre className={`${compact ? 'mt-4' : 'mt-6'} overflow-x-auto rounded-md border border-white/[0.1] bg-surface px-4 py-3 font-mono text-xs text-signal sm:text-sm`}>
      <code>{command}</code>
    </pre>
  )
}
