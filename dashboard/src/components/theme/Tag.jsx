const SEVERITY_COLOR = {
  high: 'text-severity-high border-severity-high/30 bg-severity-high/10',
  medium: 'text-severity-medium border-severity-medium/30 bg-severity-medium/10',
  low: 'text-severity-low border-severity-low/30 bg-severity-low/10',
}

export default function Tag({ severity = 'low', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide ${SEVERITY_COLOR[severity]}`}
    >
      {children}
    </span>
  )
}
