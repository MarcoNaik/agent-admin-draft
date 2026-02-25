"use client"

import { useRef, useEffect } from "react"
import { useReveal } from "@/hooks/use-reveal"
import { useI18n } from "@/lib/i18n"

function Step({
  step,
  index,
}: {
  step: { number: string; title: string; description: string }
  index: number
}) {
  const { ref, isVisible } = useReveal({ threshold: 0.2, delay: index * 150 })

  return (
    <div
      ref={ref}
      className={`relative py-16 md:py-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
    >
      <span className="absolute top-8 md:top-12 left-0 font-display text-[120px] md:text-[140px] font-bold text-charcoal/[0.04] leading-none select-none pointer-events-none">
        {step.number}
      </span>
      <div className="relative max-w-xl">
        <h3 className="font-display text-2xl md:text-3xl font-medium text-charcoal-heading mb-4">
          {step.title}
        </h3>
        <p className="text-base md:text-lg text-charcoal/70 leading-relaxed max-w-lg">
          {step.description}
        </p>
        <div className="mt-8 h-[1px] w-16 md:w-20 prismatic-border rounded-full" />
      </div>
    </div>
  )
}

export function HowItWorks() {
  const { t } = useI18n()
  const { ref, isVisible } = useReveal({ threshold: 0.2 })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingVisibleRef = useRef(false)

  useEffect(() => {
    let ticking = false

    function updateHeading() {
      if (!headingRef.current) return
      const rect = headingRef.current.getBoundingClientRect()
      const vh = window.innerHeight
      const normalized = 1 - (rect.top / vh)
      const progress = Math.min(1, Math.max(0.75, 0.75 + (normalized / 0.5) * 0.25))
      headingRef.current.style.opacity = headingVisibleRef.current ? String(progress) : "0"
      headingRef.current.style.transform = `translateY(${-200 + (progress - 0.75) * 800}px)`
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        updateHeading()
        ticking = false
      })
    }

    const timeout = setTimeout(() => {
      headingVisibleRef.current = true
      updateHeading()
    }, 9000)

    window.addEventListener("scroll", onScroll, { passive: true })
    updateHeading()
    return () => {
      clearTimeout(timeout)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <section id="como-funciona" className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div
          ref={ref}
          className="text-center mb-8"
        >
          <h2
            ref={headingRef}
            className="font-display text-6xl md:text-8xl font-medium text-charcoal-heading transition-opacity duration-1000 ease-in"
            style={{
              opacity: 0,
              transform: "translateY(-200px)",
              willChange: "opacity, transform",
            }}
          >
            {t.howItWorks.title}
          </h2>
        </div>

        <div className="divide-y divide-charcoal/5">
          {t.howItWorks.steps.map((step, index) => (
            <Step key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
