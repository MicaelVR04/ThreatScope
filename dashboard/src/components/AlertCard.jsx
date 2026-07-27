import { threatFriendlyLabel, threatLabel } from '../utils/threatLabels'

const GLYPH = { HIGH: '▲', MEDIUM: '▶', LOW: '•' }
const GLYPH_COLOR = { HIGH: 'text-severity-high', MEDIUM: 'text-severity-medium', LOW: 'text-severity-low' }

// Matches the mock's .fl exactly: only HIGH severity gets its own bold-text
// color (the glyph is colored for all three, but the label+severity text
// itself only turns red for HIGH — medium/low stay plain ink).
export default function AlertCard({ alert }) {
  const glyphColor = GLYPH_COLOR[alert.severity] || 'text-ink-faint'
  const bodyBold = alert.severity === 'HIGH' ? 'text-severity-high' : 'text-ink'
  return (
    <div className="mb-[7px] flex animate-fl-in gap-2">
      <span className="shrink-0 font-mono text-[11px] text-ink-faint">
        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className={`w-[14px] shrink-0 font-mono text-xs ${glyphColor}`}>{GLYPH[alert.severity] || '•'}</span>
      <span className="min-w-0 text-ink-muted">
        <span className="font-medium text-ink">{threatFriendlyLabel(alert.type)}</span>{' '}
        <b className={`font-semibold ${bodyBold}`}>{alert.severity}</b>
        <br />
        <span className="font-mono text-[10px] text-ink-faint">{alert.type} · {threatLabel(alert.type)}</span>
        <br />
        <span className="font-mono text-[11px] text-ink-faint">{alert.src_ip} → {alert.dst_ip}</span>
      </span>
    </div>
  )
}
