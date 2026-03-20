import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { DemoVideo } from "@/components/demo-video"
import { UseCases } from "@/components/use-cases"
import { IntegrationsBar } from "@/components/integrations-bar"
import { Pricing } from "@/components/pricing"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div>
      <Navigation />
      <HeroSection />
      <UseCases />
      <DemoVideo />
      <IntegrationsBar />
      <Pricing />
      <CTASection />
      <Footer />
    </div>
  )
}
