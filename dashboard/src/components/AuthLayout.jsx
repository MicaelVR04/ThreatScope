import { Shield, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Same fine film-grain noise as Landing.jsx, generated once at module load —
// not rebuilt, just reused so every page shares the exact same texture.
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" />
</svg>`
const NOISE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`

// No horizontal padding here — Login/Register add pl-9 (icon) and pr-3 or
// pr-10 (plain vs. password-toggle) themselves, since the two inputs need
// different right-side spacing.
export const AUTH_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.12] bg-surface-2 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint transition-colors duration-150 ease-swift hover:border-white/20 focus-visible:border-signal/40 focus-visible:ring-2 focus-visible:ring-signal/60'

export const AUTH_LINK_CLASS =
  'rounded-sm font-medium text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

// Ambient blob field — position (top/left %, spread across upper/middle/
// lower thirds and left/right so they don't cluster in one band), size,
// opacity, and which of the three drift-a/b/c loop paths each one plays.
// Matches the "2-3 ambient blobs, opacity 0.08-0.12, slow drift" guidance the
// ui-ux-pro-max skill's style match returned for this dark/glow aesthetic —
// replaced the single static radar accent, which read as dead/motionless
// once the rest of the page had its own animated glow.
//
// `wash` and `move` are full literal classes (not built from a variable) —
// Tailwind's scanner needs the exact string present in source, same reason
// the CARDS tones and Tag's severity colors are written out in full elsewhere.
const BLOBS = [
  { top: '15%', left: '15%', size: 260, wash: 'bg-signal/[0.1]', move: 'animate-drift-a' },
  { top: '50%', left: '82%', size: 300, wash: 'bg-signal/[0.08]', move: 'animate-drift-b' },
  { top: '78%', left: '38%', size: 220, wash: 'bg-signal/[0.09]', move: 'animate-drift-c' },
]

// Shared shell for auth pages (Login, Register) — noise texture, drifting
// ambient blobs, and the card header (logo/eyebrow/wordmark/subtitle). Each
// page supplies its own form fields and actions as children.
export default function AuthLayout({ eyebrow, subtitle, children }) {
  const navigate = useNavigate()

  const closeAuth = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base px-4 py-6 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Ambient blob field — each plays its own irregular loop path
          (drift-a/b/c), one animation per element, no nested wrapper
          needed since each keyframe stop already sets a full x+y position. */}
      {BLOBS.map((blob, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-full blur-3xl ${blob.move} ${blob.wash}`}
          style={{ top: blob.top, left: blob.left, width: blob.size, height: blob.size }}
        />
      ))}

      {/* Border only, no accompanying blur-shadow — pairing a 1px border with
          a wide soft shadow on the same element is the "ghost-card" pattern
          (flagged by the impeccable skill's polish audit); Hero's own panel
          uses shadow-only with no border for the same reason. A defined edge
          reads better here anyway, against the moving blob background. */}
      <div className="relative z-10 w-full max-w-[380px] animate-fade-up rounded-xl border border-white/[0.08] bg-surface p-6 sm:p-9">
        <button
          type="button"
          onClick={closeAuth}
          title="Close and go back"
          aria-label="Close and go back"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-md text-ink-faint transition-colors duration-150 ease-swift hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-signal shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_22px_-4px_rgba(46,235,209,0.35)]">
            <Shield size={22} className="text-base" strokeWidth={2.4} />
          </div>
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-signal">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">ThreatScope</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  )
}
