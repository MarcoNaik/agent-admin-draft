import dynamic from "next/dynamic"
import { Navigation } from "@/components/navigation"
import { HeroSection } from "@/components/hero-section"
import { IntegrationsBar } from "@/components/integrations-bar"
import { Footer } from "@/components/footer"

const UseCases = dynamic(() => import("@/components/use-cases").then(mod => ({ default: mod.UseCases })), { ssr: false })
const DemoVideo = dynamic(() => import("@/components/demo-video").then(mod => ({ default: mod.DemoVideo })), { ssr: false })
const Pricing = dynamic(() => import("@/components/pricing").then(mod => ({ default: mod.Pricing })), { ssr: false })
const CTASection = dynamic(() => import("@/components/cta-section").then(mod => ({ default: mod.CTASection })), { ssr: false })

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
