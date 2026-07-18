import Tag from './theme/Tag'
import { AlertTriangle, ShieldAlert, Info } from 'lucide-react'
import { threatLabel, threatPlainEnglish } from '../utils/threatLabels'

const SEVERITY_ICON = {
  HIGH:   <ShieldAlert size={16} className="text-severity-high" />,
  MEDIUM: <AlertTriangle size={16} className="text-severity-medium" />,
  LOW:    <Info size={16} className="text-severity-low" />,
}

const BORDER_COLOR = { HIGH: 'border-l-severity-high', MEDIUM: 'border-l-severity-medium', LOW: 'border-l-severity-low' }

// One-shot decaying glow, keyed to the same severity as the left border —
// plays once on mount (i.e. the moment a genuinely new alert arrives, since
// existing cards never remount when the feed refreshes).
const GLOW = { HIGH: 'animate-alert-glow-high', MEDIUM: 'animate-alert-glow-medium', LOW: 'animate-alert-glow-low' }

export default function AlertCard({ alert }) {
  const border = BORDER_COLOR[alert.severity] || 'border-l-white/20'
  const glow = GLOW[alert.severity] || ''
  return (
    <div
      className={`mb-2 animate-fade-up rounded-lg border-l-4 bg-surface px-4 py-3 transition-colors duration-150 ease-swift hover:bg-surface-2 ${border} ${glow}`}
    >
      <div className="mb-2 flex items-center gap-2.5">
        {SEVERITY_ICON[alert.severity] ?? <Info size={16} className="text-ink-muted" />}
        <Tag severity={alert.severity}>{alert.severity}</Tag>
        <span className="flex-1 text-sm font-semibold text-ink">{threatLabel(alert.type)}</span>
        <span className="ml-auto text-xs text-ink-faint">{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>
      <p className="mb-2 text-xs leading-[1.45] text-ink-muted">{threatPlainEnglish(alert.type)}</p>
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <span className="font-mono text-ink-muted">{alert.src_ip}</span>
        <span className="text-ink-faint">→</span>
        <span className="font-mono text-ink-muted">{alert.dst_ip}</span>
        {alert.protocol && <span className="rounded border border-white/[0.1] bg-base px-1.5 py-0.5 font-mono text-[11px] text-ink-faint">{alert.protocol}</span>}
        {alert.dst_port && <span className="rounded border border-white/[0.1] bg-base px-1.5 py-0.5 font-mono text-[11px] text-ink-faint">:{alert.dst_port}</span>}
      </div>
    </div>
  )
}
