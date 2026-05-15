const COLORS = {
  HIGH:   { bg: '#fee2e2', text: '#ef4444' },
  MEDIUM: { bg: '#fef9c3', text: '#f59e0b' },
  LOW:    { bg: '#dcfce7', text: '#22c55e' },
}

export default function SeverityBadge({ severity }) {
  const { bg, text } = COLORS[severity] || { bg: '#1e293b', text: '#94a3b8' }
  return (
    <span style={{
      background: bg,
      color: text,
      padding: '2px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 'bold',
      letterSpacing: 1,
    }}>
      {severity}
    </span>
  )
}
