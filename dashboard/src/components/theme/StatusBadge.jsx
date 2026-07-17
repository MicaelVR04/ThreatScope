import { ScanSearch, ShieldCheck, ShieldAlert } from 'lucide-react'

const STATES = {
  scanning: {
    Icon: ScanSearch,
    label: 'Scanning',
    color: 'text-signal border-signal/30 bg-signal-dim',
  },
  secure: {
    Icon: ShieldCheck,
    label: 'Secure',
    color: 'text-severity-low border-severity-low/30 bg-severity-low/10',
  },
  alert: {
    Icon: ShieldAlert,
    label: 'Alert',
    color: 'text-severity-high border-severity-high/30 bg-severity-high/10',
  },
}

export default function StatusBadge({ status, label }) {
  const state = STATES[status]
  if (!state) return null
  const { Icon, color } = state

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wide ${color}`}
    >
      {/* Ongoing-process cue — reuses the existing pulse keyframe (already
          covered by the global prefers-reduced-motion rule in index.css),
          rather than a spinning icon, to match the nav's live-status dot. */}
      <Icon size={13} strokeWidth={2} className={status === 'scanning' ? 'animate-pulse' : ''} />
      {label ?? state.label}
    </span>
  )
}
