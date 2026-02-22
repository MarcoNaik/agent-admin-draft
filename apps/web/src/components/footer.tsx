"use client"

import { useReveal } from "@/hooks/use-reveal"

export function Footer() {
  const { ref, isVisible } = useReveal({ threshold: 0.3 })

  return (
    <footer ref={ref} className="relative bg-cream-card">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div className="h-px bg-forest/10" />
      </div>

      <div className="mx-auto max-w-4xl px-6 md:px-12 py-16">
        <p
          className={`text-center text-[10px] tracking-wider text-forest-accent/50 transition-all duration-1000 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          Struere — You describe it. We build it.
        </p>
        <div
          className={`flex justify-center gap-6 mt-6 transition-all duration-1000 ease-out ${
            isVisible ? "opacity-50 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <a
            href="/privacy-policy"
            className="text-[10px] tracking-wider text-forest-accent/50 hover:text-forest-accent transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/terms-of-service"
            className="text-[10px] tracking-wider text-forest-accent/50 hover:text-forest-accent transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  )
}
