import { Shield } from 'lucide-react'

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

export const AUTH_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.12] bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint transition-colors duration-150 ease-swift focus-visible:border-signal/40 focus-visible:ring-2 focus-visible:ring-signal/60'

// Shared shell for auth pages (Login, Register) — noise texture, centered
// radar-sweep accent, ambient float glow, and the card header (logo/eyebrow/
// wordmark/subtitle). Each page supplies its own form fields and actions
// as children.
export default function AuthLayout({ eyebrow, subtitle, children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Radar accent — the exact animate-radar-sweep utility the Hero uses,
          just centered and scaled down rather than corner-positioned, so it
          reads as ambient brand texture behind the card, not a focal point. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 opacity-[0.15]"
      >
        <div className="h-full w-full animate-radar-sweep rounded-full [background:conic-gradient(from_0deg,transparent_0deg,theme(colors.signal.DEFAULT)_18deg,transparent_60deg)]" />
        <div className="absolute inset-0 rounded-full border border-signal/20" />
        <div className="absolute inset-10 rounded-full border border-signal/10" />
      </div>

      {/* Ambient glow — same two-div float technique as the CTA section's
          glow (a CSS `animation` replaces an element's whole transform per
          frame, so centering and the float animation are split across two
          elements to avoid fighting each other). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="h-full w-full animate-float rounded-full bg-signal/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[380px] animate-fade-up rounded-xl border border-white/[0.08] bg-surface p-9 shadow-[0_0_60px_-20px_rgba(46,235,209,0.2)]">
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
