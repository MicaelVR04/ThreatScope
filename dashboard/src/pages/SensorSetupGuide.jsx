import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  KeyRound,
  Laptop,
  Monitor,
  Power,
  Shield,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

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
          Sensor project preview
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
              body="It runs as a normal background process. You can see it in Activity Monitor on macOS or Task Scheduler on Windows."
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
            <Download size={20} className="text-signal" />
            <h2 className="font-display text-2xl font-semibold">Install without Terminal</h2>
          </div>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-muted">
            Sign in to the dashboard and open <strong className="text-ink">Sensor installation</strong>.
            The setup uses a short-lived code, so the installer never contains a shared password or API key.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <InstallStep Icon={Download} number="1" title="Download" body="Choose macOS or Windows in the dashboard, extract the ZIP, and open the guided setup." />
            <InstallStep Icon={KeyRound} number="2" title="Connect" body="Generate an installation code in the dashboard and paste it into the setup app." />
            <InstallStep Icon={CheckCircle2} number="3" title="Approve" body="Approve the normal macOS or Windows administrator prompt, then wait for the connected confirmation." />
          </div>

          <div className="mt-8 border-l-2 border-signal/50 pl-4">
            <div className="flex items-center gap-2">
              <Monitor size={18} className="text-signal" />
              <h3 className="font-display text-sm font-semibold text-ink">Windows 10 and 11 project preview</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">
              Install Python 3.11 and <a href="https://npcap.com/#download" target="_blank" rel="noreferrer" className="font-semibold text-signal hover:text-signal/80">Npcap</a> from their official sites first. Extract the Windows ZIP, double-click <strong className="text-ink">Start ThreatScope Sensor Setup</strong>, approve User Account Control, and paste the one-time code. Do not disable Microsoft Defender or Windows security.
            </p>
          </div>

          <div className="mt-8 border-l-2 border-signal/50 pl-4">
            <h3 className="font-display text-sm font-semibold text-ink">Updates clean up the previous registration</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">
              When setup replaces an existing ThreatScope sensor on the same Mac, it waits for the new sensor&apos;s
              first successful heartbeat before revoking the previous local registration. It never removes a
              different Mac. If automatic cleanup cannot reach the API, the older entry remains available for
              you to remove from <strong className="text-ink">Manage sensors</strong>.
            </p>
          </div>

          <div className="mt-8 border-l-2 border-severity-medium/60 pl-4">
            <h3 className="font-display text-sm font-semibold text-ink">Why macOS may show “Open Anyway”</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">
              This school-project build is integrity-signed but not notarized through Apple. Try opening it
              once and dismiss the warning with <strong className="text-ink">Done</strong>. Then open
              <strong className="text-ink"> System Settings → Privacy &amp; Security</strong>, scroll to Security,
              choose <strong className="text-ink">Open Anyway</strong>, enter your password, and confirm Open.
              Apple shows that option for about one hour after the blocked launch. Do not disable Gatekeeper
              or run quarantine-removal commands. Download the app only from the official ThreatScope dashboard.
            </p>
            <a
              href="https://support.apple.com/en-us/102445"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex font-display text-xs font-semibold text-signal hover:text-signal/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              Apple: Safely open apps on your Mac
            </a>
          </div>
        </section>

        <section className="border-t border-white/[0.1] py-14">
          <div className="flex items-center gap-3">
            <Power size={20} className="text-signal" />
            <h2 className="font-display text-2xl font-semibold">Pause or remove it anytime</h2>
          </div>
          <p className="mt-4 max-w-3xl leading-relaxed text-ink-muted">
            The dashboard&apos;s <strong className="text-ink">Stop monitoring</strong> button
            pauses packet inspection while leaving the lightweight service connected.
            To remove it completely, reopen <strong className="text-ink">ThreatScope Sensor Setup</strong>,
            choose <strong className="text-ink">Remove Sensor</strong>, and approve the administrator prompt.
          </p>
          <div className="mt-6 flex max-w-3xl items-start gap-3 border-l-2 border-signal/50 pl-4">
            <Laptop size={18} className="mt-0.5 shrink-0 text-signal" />
            <p className="text-sm leading-relaxed text-ink-muted">
              Removing the local app stops the background service and deletes its root-only credential.
              You can also use <strong className="text-ink">Remove access</strong> in the dashboard to revoke
              a lost or unavailable computer immediately.
            </p>
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

function InstallStep({ Icon, number, title, body }) {
  return (
    <div className="border-t border-white/[0.1] pt-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full border border-signal/30 bg-signal-dim text-signal">
          <Icon size={16} />
        </div>
        <span className="font-mono text-xs text-ink-faint">STEP {number}</span>
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  )
}
