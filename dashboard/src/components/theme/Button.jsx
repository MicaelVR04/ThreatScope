const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-display font-semibold transition-all duration-150 ease-swift active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-base'

const VARIANTS = {
  primary:
    'bg-signal text-base hover:scale-[1.02] hover:shadow-[0_0_28px_-4px_rgba(46,235,209,0.65)]',
  secondary:
    'border border-white/[0.12] text-ink-muted hover:border-signal/30 hover:text-signal',
  ghost: 'text-ink-muted hover:text-signal',
}

const SIZES = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
