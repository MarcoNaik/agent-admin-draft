"use client"

import { useReveal } from "@/hooks/use-reveal"

const metrics = [
  { value: "2,000+", label: "negocios" },
  { value: "15", label: "paises" },
  { value: "50,000+", label: "agentes creados" },
  { value: "4.8\u2605", label: "satisfaccion" },
]

export function SocialProofBar() {
  const { ref, isVisible } = useReveal({ threshold: 0.3 })

  return (
    <section ref={ref} className="bg-stone-deep py-10 border-y border-charcoal/5">
      <div
        className={`mx-auto max-w-4xl px-6 md:px-12 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12">
          {metrics.map((metric, i) => (
            <div key={metric.label} className="flex items-center gap-6 md:gap-12">
              <div className="text-center">
                <span className="text-lg font-display font-semibold text-charcoal-heading">
                  {metric.value}
                </span>
                <span className="ml-2 text-sm text-charcoal/50">
                  {metric.label}
                </span>
              </div>
              {i < metrics.length - 1 && (
                <div className="hidden md:block w-px h-5 bg-charcoal/10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
