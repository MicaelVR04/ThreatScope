import LandingNav from '../components/landing/LandingNav'
import Hero from '../components/landing/Hero'
import Capabilities from '../components/landing/Capabilities'
import HowItWorks from '../components/landing/HowItWorks'
import Stats from '../components/landing/Stats'
import CTA from '../components/landing/CTA'
import Footer from '../components/landing/Footer'

export default function Landing() {
  return (
    <div className="min-h-screen bg-base font-sans text-ink">
      <LandingNav />
      <main>
        <Hero />
        <Capabilities />
        <HowItWorks />
        <Stats />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
