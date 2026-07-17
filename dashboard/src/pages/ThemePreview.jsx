import { Radar, ShieldCheck } from 'lucide-react'
import Button from '../components/theme/Button'
import { Panel, PanelRow } from '../components/theme/Panel'
import StatusBadge from '../components/theme/StatusBadge'
import Tag from '../components/theme/Tag'
import AlertCard from '../components/AlertCard'
import AlertTable from '../components/AlertTable'
import Navbar from '../components/Navbar'
import AlertHistory from './AlertHistory'
import Dashboard from './Dashboard'

// Mock data purely for visually verifying the Tag migration inside the real
// AlertCard/AlertTable components — no API calls, no real dashboard route.
const MOCK_ALERTS = [
  { id: 1, severity: 'HIGH', type: 'ARP_SPOOF', src_ip: '10.0.0.14', dst_ip: '10.0.0.1', protocol: 'ARP', timestamp: new Date().toISOString() },
  { id: 2, severity: 'MEDIUM', type: 'PORT_SCAN', src_ip: '10.0.0.22', dst_ip: '10.0.0.1', protocol: 'TCP', dst_port: 22, timestamp: new Date().toISOString() },
  { id: 3, severity: 'LOW', type: 'PING_SWEEP', src_ip: '10.0.0.31', dst_ip: '10.0.0.255', protocol: 'ICMP', timestamp: new Date().toISOString() },
]

// Isolated review page for the theme/ component set — not wired into any
// real dashboard data or route flow. Safe to delete once reviewed; not part
// of the finished product surface.
function Block({ title, children }) {
  return (
    <section className="mb-16">
      <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  )
}

export default function ThemePreview() {
  return (
    <div className="min-h-screen bg-base px-6 py-16 text-ink">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-12 font-display text-3xl font-bold tracking-tight">
          Theme components preview
        </h1>

        <Block title="Button">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" size="sm">Primary / sm</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Block>

        <section className="mb-16">
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            Navbar (real component, mock props) — connected / disconnected
          </p>
          <div className="flex flex-col gap-2">
            <Navbar connected={true} userEmail="analyst@threatscope.dev" signingOut={false} onLogout={() => {}} />
            <Navbar connected={false} userEmail="analyst@threatscope.dev" signingOut={false} onLogout={() => {}} />
          </div>
        </section>

        <Block title="Status Badge">
          <StatusBadge status="monitoring" />
          <StatusBadge status="scanning" />
          <StatusBadge status="secure" />
          <StatusBadge status="alert" />
          <StatusBadge status="alert" label="3 threats detected" />
        </Block>

        <Block title="Severity Tag">
          <Tag severity="high">Port Scan</Tag>
          <Tag severity="medium">Suspicious Login</Tag>
          <Tag severity="low">Routine Traffic</Tag>
        </Block>

        <section className="mb-16">
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            AlertCard (real component, mock data)
          </p>
          <div className="flex flex-col gap-2">
            {MOCK_ALERTS.map(alert => <AlertCard key={alert.id} alert={alert} />)}
          </div>
        </section>

        <section className="mb-16">
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            AlertTable (real component, mock data)
          </p>
          <AlertTable alerts={MOCK_ALERTS} />
        </section>

        <section className="mb-16">
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            AlertHistory (real page, no backend — shows loading/error state)
          </p>
          <div className="border border-white/[0.08]">
            <AlertHistory />
          </div>
        </section>

        <section className="mb-16">
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            Dashboard (real page, no backend — shows "monitoring" default state)
          </p>
          <div className="border border-white/[0.08]">
            <Dashboard onConnectionChange={() => {}} />
          </div>
        </section>

        <section className="mb-16">
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            Panel / divided list
          </p>
          <Panel>
            <PanelRow
              icon={Radar}
              title="Live Packet Capture"
              body="A Scapy-powered engine inspects traffic as it crosses the wire."
              action={<StatusBadge status="scanning" />}
            />
            <PanelRow
              icon={ShieldCheck}
              title="Rule-Based Signature Detection"
              body="Known attack patterns matched against live traffic in real time."
              action={<Button variant="secondary" size="sm">Configure</Button>}
            />
          </Panel>
        </section>
      </div>
    </div>
  )
}
