// Divided-list container, matching the landing page's Capabilities section —
// deliberately not a bordered-card grid, which the Impeccable audit flagged
// as a generic/AI-tell pattern during the landing-page polish pass.
export function Panel({ children, className = '' }) {
  return (
    <div className={`border-t border-white/[0.08] ${className}`}>{children}</div>
  )
}

export function PanelRow({ icon: Icon, title, body, action }) {
  return (
    <div className="group flex items-start gap-4 border-b border-white/[0.08] py-6">
      {Icon && (
        <Icon
          size={20}
          className="mt-0.5 shrink-0 text-signal transition-transform duration-200 ease-swift group-hover:rotate-6 group-hover:scale-110"
          strokeWidth={1.75}
        />
      )}
      <div className="flex-1">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {body && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
