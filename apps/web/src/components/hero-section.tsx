"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { useReveal } from "@/hooks/use-reveal"
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
    <span
      className={`font-mono text-white/30 transition-opacity duration-600 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {items[index]}
    </span>
  )
}

function RevealBlock({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const { ref, isVisible } = useReveal({ delay })
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
    >
      {children}
    </div>
  )
}

export function HeroSection() {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [parallaxY, setParallaxY] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      if (prefersReduced) return
      setParallaxY(window.scrollY * 0.08)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    window.location.href = "https://app.struere.dev"
  }, [])

  return (
    <section className="relative w-full min-h-screen flex flex-col pb-10 md:pb-16">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ transform: `translateY(${parallaxY}px)` }}
      >
        <Image
          src="/hero-bg.png"
          alt=""
          fill
          priority
          className="object-cover object-center md:object-center"
          style={{ objectPosition: "60% center" }}
          sizes="100vw"
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(248,246,242,0.95) 0%, rgba(248,246,242,0.6) 8%, rgba(248,246,242,0.15) 18%, transparent 22%)",
        }}
      />

      <div className="min-h-[52vh]" aria-hidden="true" />
      <div className="relative w-full max-w-3xl mx-auto px-6 md:px-12 text-center mt-auto">
        <RevealBlock>
          <p className="text-[10px] tracking-[0.2em] uppercase text-white/70 mb-4 font-sans">
            {t.hero.tagline}
          </p>
        </RevealBlock>

        <RevealBlock delay={150}>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-white leading-[1.1] drop-shadow-[0_2px_24px_rgba(0,0,0,0.3)]">
            {t.hero.headline}
          </h1>
        </RevealBlock>

        <RevealBlock delay={300}>
          <p className="mt-6 text-lg md:text-xl text-white/90 max-w-xl mx-auto leading-relaxed font-sans drop-shadow-[0_1px_12px_rgba(0,0,0,0.25)]">
            {t.hero.subheadline}
          </p>
        </RevealBlock>

        <RevealBlock delay={500}>
          <form onSubmit={handleSubmit} className="mt-10">
            <div
              className={`relative bg-white/12 backdrop-blur-2xl rounded-2xl transition-all duration-300 overflow-hidden ${
                isFocused ? "shadow-lg shadow-ocean/10" : ""
              }`}
            >
              <div
                className={`absolute inset-0 rounded-2xl p-[1px] pointer-events-none ${
                  isFocused ? "prismatic-border-animated" : ""
                }`}
              >
                <div className="w-full h-full rounded-2xl bg-white/12 backdrop-blur-2xl" />
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
                    className="w-full px-6 pt-5 pb-14 text-base bg-transparent text-white placeholder:text-transparent focus:outline-none resize-none leading-relaxed relative z-10 font-sans"
                    aria-label={t.hero.ariaLabel}
                  />
                  {!prompt && !isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none">
                      <CyclingPlaceholder items={t.hero.placeholders} />
                    </div>
                  )}
                  {!prompt && isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none font-mono text-white/30">
                      {t.hero.focusPlaceholder}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-3 right-3 z-10">
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-sm font-medium bg-amber hover:bg-amber-light text-charcoal-heading rounded-xl transition-all duration-200"
                  >
                    {t.hero.createButton} &rarr;
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {t.hero.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="px-4 py-2 text-xs text-white/60 hover:text-white/90 bg-white/8 hover:bg-white/15 backdrop-blur-sm border border-white/10 hover:border-white/25 rounded-full transition-all duration-200 font-sans"
                >
                  {s}
                </button>
              ))}
            </div>
          </form>
        </RevealBlock>

        <RevealBlock delay={700}>
          <p className="mt-8 text-xs text-white/50 font-sans">
            {t.hero.proofLine}
          </p>
        </RevealBlock>
      </div>
    </section>
  )
}
