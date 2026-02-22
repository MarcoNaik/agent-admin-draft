"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { useI18n } from "@/lib/i18n"
import { useHeroEntrance } from "@/lib/hero-entrance"

function CyclingPlaceholder({ items, delay = 0 }: { items: readonly string[]; delay?: number }) {
  const [active, setActive] = useState(delay === 0)
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (delay === 0) return
    const timeout = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(timeout)
  }, [delay])

  useEffect(() => {
    if (!active) return

    const current = items[index]

    if (!isDeleting && displayed.length < current.length) {
      const timeout = setTimeout(() => {
        setDisplayed(current.slice(0, displayed.length + 1))
      }, 35 + Math.random() * 25)
      return () => clearTimeout(timeout)
    }

    if (!isDeleting && displayed.length === current.length) {
      const timeout = setTimeout(() => setIsDeleting(true), 3000)
      return () => clearTimeout(timeout)
    }

    if (isDeleting && displayed.length > 0) {
      const timeout = setTimeout(() => {
        setDisplayed(displayed.slice(0, -1))
      }, 20)
      return () => clearTimeout(timeout)
    }

    if (isDeleting && displayed.length === 0) {
      setIsDeleting(false)
      setIndex((prev) => (prev + 1) % items.length)
    }
  }, [active, displayed, isDeleting, index, items])

  return (
    <span className="font-input text-white/80">
      {displayed}
      <span className="inline-block w-[2px] h-[1.1em] bg-white/60 ml-[1px] align-text-bottom animate-[blink-caret_1s_step-end_infinite]" />
    </span>
  )
}

export function HeroSection() {
  const { t } = useI18n()
  const mounted = useHeroEntrance()
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
    <section className="relative w-full min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ transform: `translateY(${parallaxY}px)` }}
        >
          <Image
            src="/hero-bg.png"
            alt=""
            fill
            priority
            className={`object-cover transition-transform duration-[10000ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${mounted ? "scale-[1.03]" : "scale-100"}`}
            style={{ objectPosition: "center center" }}
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
      </div>

      <div className="absolute top-[8%] md:top-[10%] left-0 right-0 text-center px-6 md:px-12">
        <div className="max-w-3xl mx-auto">
          <div
            className={`ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100" : "opacity-0"}`}
            style={{
              transitionProperty: "opacity",
              transitionDuration: "900ms",
            }}
          >
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-semibold text-white leading-[1.1] whitespace-nowrap drop-shadow-[0_2px_24px_rgba(0,0,0,0.3)]">
              {t.hero.headline}
            </h1>
          </div>

          <div
            className={`ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
            style={{
              transitionProperty: "opacity, transform",
              transitionDuration: "700ms",
              transitionDelay: mounted ? "500ms" : "0ms",
            }}
          >
            <p className="text-xs tracking-[0.25em] uppercase text-white mt-4 font-sans font-medium drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
              {t.hero.tagline}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-32 md:bottom-36 left-0 right-0 text-center px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div
              className={`liquid-glass rounded-2xl ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              style={{
                transitionProperty: "opacity, transform",
                transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                transitionDuration: "400ms, 2000ms",
                transitionDelay: mounted ? "900ms, 1000ms" : "0ms, 0ms",
              }}
            >
              <div className="relative z-10">
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
                    className="w-full px-6 pt-5 pb-14 text-base text-left bg-transparent text-white placeholder:text-transparent focus:outline-none resize-none leading-relaxed font-input"
                    aria-label={t.hero.ariaLabel}
                  />
                  {!prompt && !isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none text-left">
                      <CyclingPlaceholder items={t.hero.placeholders} delay={4500} />
                    </div>
                  )}
                  {!prompt && isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none font-input text-white/80 text-left">
                      {t.hero.focusPlaceholder}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-3 right-3">
                  <div
                    className={`ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
                    style={{
                      transitionProperty: "opacity, transform",
                      transitionDuration: "1000ms",
                      transitionDelay: mounted ? "7500ms" : "0ms",
                    }}
                  >
                    <button
                      type="submit"
                      className="hero-send-btn px-6 py-2.5 text-sm font-medium text-white/70 rounded-xl border border-transparent bg-transparent"
                    >
                      <span className="relative z-10 flex items-center gap-1.5">
                        {t.hero.createButton}
                        <span className="btn-arrow">&rarr;</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {t.hero.suggestions.map((s, i) => {
                const base = 2200 + i * 250
                return (
                  <div
                    key={s}
                    className={`liquid-glass rounded-full ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
                    style={{
                      transitionProperty: "opacity, transform",
                      transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                      transitionDuration: "300ms, 500ms",
                      transitionDelay: mounted ? `${base}ms, ${base + 100}ms` : "0ms, 0ms",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPrompt(s)}
                      className="px-4 py-2 text-xs text-white/90 hover:text-white hover:bg-white/20 rounded-full transition-all duration-200 font-sans"
                    >
                      {s}
                    </button>
                  </div>
                )
              })}
            </div>
          </form>

        </div>
      </div>
    </section>
  )
}
