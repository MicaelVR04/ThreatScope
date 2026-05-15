const COLORS = {
  HIGH:   { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', dot: '#ef4444' },
  MEDIUM: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', dot: '#f59e0b' },
  LOW:    { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', dot: '#22c55e' },
}

export default function SeverityBadge({ severity }) {
  const { bg, text, dot } = COLORS[severity] || { bg: '#1e293b', text: '#94a3b8', dot: '#94a3b8' }
  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      gap:            6,
      background:     bg,
      color:          text,
      padding:        '3px 10px',
      borderRadius:   99,
      fontSize:       11,
      fontWeight:     'bold',
      letterSpacing:  0.8,
      border:         `1px solid ${dot}40`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {severity}
    </span>
  )
}
