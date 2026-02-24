import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { HowItWorks } from "@/components/how-it-works"
import { UseCases } from "@/components/use-cases"
import { Integrations } from "@/components/integrations"
import { Pricing } from "@/components/pricing"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div>
      <Navigation />
      <HeroSection />
      <HowItWorks />
      <UseCases />
      <Integrations />
      <Pricing />
      <CTASection />
      <Footer />
    </div>
  )
}
