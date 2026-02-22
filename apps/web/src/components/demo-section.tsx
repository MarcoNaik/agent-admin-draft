"use client"

import { useReveal } from "@/hooks/use-reveal"

export function DemoSection() {
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section className="relative bg-cream py-28 md:py-36">
      <div ref={ref} className="mx-auto max-w-4xl px-6 md:px-12">
        <div
          className={`text-center mb-12 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-[9px] tracking-[0.3em] uppercase text-forest-accent/50 mb-3">
            Demo
          </p>
          <h2 className="text-2xl md:text-3xl tracking-tight text-forest font-light">
            See it in action
          </h2>
        </div>

        <div
          className={`transition-all duration-700 ease-out delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="relative aspect-video rounded-2xl bg-cream-card border border-forest/10 flex items-center justify-center overflow-hidden">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-forest ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-xs text-forest-accent/50 tracking-wide">
                Video coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
