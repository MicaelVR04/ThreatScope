import { Radar, ShieldCheck } from 'lucide-react'
import Button from '../components/theme/Button'
import { Panel, PanelRow } from '../components/theme/Panel'
import StatusBadge from '../components/theme/StatusBadge'
import Tag from '../components/theme/Tag'

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
          <Button variant="primary" disabled>Disabled</Button>
        </Block>

        <Block title="Status Badge">
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
