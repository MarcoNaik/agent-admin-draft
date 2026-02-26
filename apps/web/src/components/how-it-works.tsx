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
      className={`relative py-16 md:py-20 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
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
  const headingRef = useRef<HTMLHeadingElement>(null)
  const revealedRef = useRef(false)

  useEffect(() => {
    const el = headingRef.current
    if (!el) return

    let ticking = false
    let elTop = el.getBoundingClientRect().top + window.scrollY

    function reveal() {
      if (revealedRef.current) return
      revealedRef.current = true
      el!.style.opacity = "1"
    }

    function updateParallax() {
      const vh = window.innerHeight
      const viewportTop = elTop - window.scrollY
      const normalized = Math.min(1, Math.max(0, 1 - viewportTop / vh))
      el!.style.transform = `translateY(${-200 + normalized * 200}px)`
    }

    const timeout = setTimeout(reveal, 9000)

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        reveal()
        updateParallax()
        ticking = false
      })
    }

    const onResize = () => {
      el!.style.transform = "none"
      elTop = el!.getBoundingClientRect().top + window.scrollY
      updateParallax()
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize, { passive: true })
    updateParallax()

    return () => {
      clearTimeout(timeout)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return (
    <section id="como-funciona" className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div className="text-center mb-8">
          <h2
            ref={headingRef}
            className="font-display text-6xl md:text-8xl font-medium text-charcoal-heading"
            style={{
              opacity: 0,
              willChange: "opacity, transform",
              transition: "opacity 0.8s ease-out",
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
