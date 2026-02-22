import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { HowItWorks } from "@/components/how-it-works"
import { UseCases } from "@/components/use-cases"
import { DemoSection } from "@/components/demo-section"
import { Integrations } from "@/components/integrations"
import { EarlyAccess } from "@/components/early-access"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div>
      <Navigation />
      <HeroSection />
      <HowItWorks />
      <UseCases />
      <DemoSection />
      <Integrations />
      <EarlyAccess />
      <CTASection />
      <Footer />
    </div>
  )
}
