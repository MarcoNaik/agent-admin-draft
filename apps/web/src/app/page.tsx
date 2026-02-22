import { HeroSection } from "@/components/hero-section"
import { DemoSection } from "@/components/demo-section"
import { FeaturesSection } from "@/components/features-section"
import { HowItWorks } from "@/components/how-it-works"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div>
      <HeroSection />
      <DemoSection />
      <FeaturesSection />
      <HowItWorks />
      <CTASection />
      <Footer />
    </div>
  )
}
