import LandingNav from '../components/landing/LandingNav'
import Hero from '../components/landing/Hero'
import Capabilities from '../components/landing/Capabilities'
import HowItWorks from '../components/landing/HowItWorks'
import SensorSetup from '../components/landing/SensorSetup'
import Stats from '../components/landing/Stats'
import CTA from '../components/landing/CTA'
import Footer from '../components/landing/Footer'

// Fine film-grain noise, generated once at module load (not per-render) as a
// small tiled SVG — fractalNoise at a high baseFrequency reads as fine
// speckle, not the smooth blobby "marble" look a low baseFrequency gives.
// stitchTiles="stitch" keeps the 200px tile repeating without a visible seam.
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" />
</svg>`
const NOISE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-base font-sans text-ink">
      {/* Static grain texture, applied once at the page root — one
          continuous layer, no seams at section boundaries. Purely
          decorative, hidden from the a11y tree, painted first (DOM order)
          so every section's content and glows stack on top of it.
          Opacity capped at 2%: feTurbulence noise can peak near full white
          at its brightest pixels, same as a worst-case grid-line overlap —
          2% is the exact ceiling already verified to keep ink-faint at
          4.5:1+ against the base even when a bright pixel lands under it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("${NOISE_DATA_URI}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />
      <LandingNav />
      <main>
        <Hero />
        <Capabilities />
        <HowItWorks />
        <SensorSetup />
        <Stats />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
