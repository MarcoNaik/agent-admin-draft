"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { useFadeSlideUp } from "@/hooks/use-scroll-transforms"
import { useI18n } from "@/lib/i18n"

function CyclingPlaceholder({ items }: { items: readonly string[] }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % items.length)
        setVisible(true)
      }, 600)
    }, 4500)
    return () => clearInterval(interval)
  }, [items.length])

  return (
    <span className={`font-mono text-charcoal/25 transition-opacity duration-600 ${visible ? "opacity-100" : "opacity-0"}`}>
      {items[index]}
    </span>
  )
}

export function CTASection() {
  const { t } = useI18n()
  const { ref, smoothProgress } = useScrollAnimation()
  const { opacity, y } = useFadeSlideUp(smoothProgress)
  const [prompt, setPrompt] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = prompt.trim() ? `?studio=${encodeURIComponent(prompt.trim())}` : "?studio="
    window.location.href = `https://app.struere.dev${params}`
  }

  return (
    <section className="relative bg-gradient-to-b from-stone-base to-stone-deep py-24 md:py-32">
      <div ref={ref} className="mx-auto max-w-3xl px-6 md:px-12 text-center">
        <motion.div style={{ opacity, y }}>
          <h2 className="font-display text-4xl md:text-5xl font-medium text-charcoal-heading mb-4">{t.cta.title}</h2>
          <p className="text-lg text-charcoal/50 mb-10">{t.cta.subtitle}</p>

          <form onSubmit={handleSubmit}>
            <div
              className={`relative bg-white/60 backdrop-blur-xl rounded-2xl transition-shadow duration-300 overflow-hidden ${
                isFocused ? "shadow-lg shadow-ocean/10" : ""
              }`}
            >
              <div
                className={`absolute inset-0 rounded-2xl p-[1px] pointer-events-none ${
                  isFocused ? "prismatic-border-animated" : ""
                }`}
              >
                <div className="w-full h-full rounded-2xl bg-white/60 backdrop-blur-xl" />
              </div>

              <div className="relative">
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                    rows={3}
                    className="w-full px-6 pt-5 pb-14 text-base bg-transparent text-charcoal placeholder:text-transparent focus:outline-none resize-none leading-relaxed relative z-10"
                    aria-label={t.cta.ariaLabel}
                  />
                  {!prompt && !isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none">
                      <CyclingPlaceholder items={t.hero.placeholders} />
                    </div>
                  )}
                  {!prompt && isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none font-mono text-charcoal/25">
                      {t.cta.focusPlaceholder}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-3 right-3 z-10">
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-sm font-medium bg-ocean text-white hover:bg-ocean-light rounded-xl transition-colors duration-200"
                  >
                    {t.cta.createButton} &rarr;
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {t.hero.suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setPrompt(s.prompt)}
                  className="px-4 py-2 text-xs text-charcoal/50 hover:text-charcoal/80 bg-charcoal/3 hover:bg-charcoal/8 border border-charcoal/5 hover:border-charcoal/15 rounded-full transition-colors duration-200"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  )
}
