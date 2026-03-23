import dynamic from "next/dynamic"
import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { IntegrationsBar } from "@/components/integrations-bar"
import { Footer } from "@/components/footer"

const UseCases = dynamic(() => import("@/components/use-cases").then(mod => ({ default: mod.UseCases })))
const DemoVideo = dynamic(() => import("@/components/demo-video").then(mod => ({ default: mod.DemoVideo })))
const Pricing = dynamic(() => import("@/components/pricing").then(mod => ({ default: mod.Pricing })))
const CTASection = dynamic(() => import("@/components/cta-section").then(mod => ({ default: mod.CTASection })))

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
