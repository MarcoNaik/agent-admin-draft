"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
    <span className="font-input font-medium text-white/95">
      {displayed}
      <span className="inline-block w-[2px] h-[1.1em] bg-white/60 ml-[1px] align-text-bottom animate-[blink-caret_1s_step-end_infinite]" />
    </span>
  )
}

export function HeroSection() {
  const { t } = useI18n()
  const { mounted, setImageLoaded } = useHeroEntrance()
  const [prompt, setPrompt] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const promptCardRef = useRef<HTMLDivElement>(null)
  const promptBtnRef = useRef<HTMLDivElement>(null)
  const promptPillsRef = useRef<HTMLDivElement>(null)
  const promptRevealedRef = useRef(false)

  useEffect(() => {
    function revealPrompt() {
      if (promptRevealedRef.current) return
      promptRevealedRef.current = true
      if (promptCardRef.current) {
        promptCardRef.current.style.opacity = "1"
        promptCardRef.current.style.transform = "translateY(0)"
      }
      if (promptBtnRef.current) {
        const btn = promptBtnRef.current
        setTimeout(() => { btn.style.opacity = "1" }, 800)
      }
      if (promptPillsRef.current) {
        const pills = promptPillsRef.current.children
        for (let i = 0; i < pills.length; i++) {
          const pill = pills[i] as HTMLElement
          const delay = 200 + i * 150
          setTimeout(() => {
            pill.style.opacity = "1"
            pill.style.transform = "translateY(0)"
          }, delay)
        }
      }
    }

    if (!mounted) return
    const timeout = setTimeout(revealPrompt, 3100)

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        if (!reducedMotion && parallaxRef.current) {
          parallaxRef.current.style.transform = `translateY(${window.scrollY * 0.08}px)`
        }
        revealPrompt()
        ticking = false
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      clearTimeout(timeout)
      window.removeEventListener("scroll", onScroll)
    }
  }, [mounted])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const params = prompt.trim() ? `?studio=${encodeURIComponent(prompt.trim())}` : "?studio="
    window.location.href = `https://app.struere.dev${params}`
  }, [prompt])

  return (
    <section className="relative w-full min-h-screen overflow-hidden z-10">
      <div
        className="absolute inset-0"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 92%, transparent 100%)",
        }}
      >
        <div
          ref={parallaxRef}
          className="absolute inset-0 overflow-hidden"
        >
          <Image
            src="/hero-bg.png"
            alt=""
            fill
            priority
            onLoad={setImageLoaded}
            className={`object-cover transition-transform duration-[10000ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${mounted ? "scale-[1.03]" : "scale-100"}`}
            style={{
              objectPosition: "center center",
            }}
            sizes="100vw"
          />
        </div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 35%, transparent 60%)",
        }}
      />

      <div className="absolute top-[8%] md:top-[10%] left-0 right-0 text-center px-6 md:px-12">
        <div className="max-w-3xl mx-auto">
          <div
            className={`ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100" : "opacity-0"}`}
            style={{
              transitionProperty: "opacity",
              transitionDuration: "900ms",
            }}
          >
            <h1
              className={`hero-gradient-text font-display text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.1] whitespace-nowrap ${mounted ? "hero-animate" : ""}`}
              style={{
                backgroundImage:
                  "linear-gradient(-90deg, #98a8b0, #7898b0, #5880a8, #5880a8, #4878a8, #4870a0, #5078a0, #6890a8, #90a8b8, #b8c0c8 56%, #d8d0c0 58%, #f0e8d8 59%, #e8e8e0 60%, #a0c0e0 62%, #80a8d0, #6888a8, #8898a8)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 2px 24px rgba(0,0,0,0.15))",
              }}
            >
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
            <p
              className={`hero-tagline-gradient text-xs tracking-[0.25em] uppercase mt-4 font-sans font-medium ${mounted ? "hero-animate" : ""}`}
              style={{
                backgroundImage:
                  "linear-gradient(-90deg, #4870a0, #5888b0, #6898c0, #80a8d0, #6898c0, #5888b0, #4870a0)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 1px 8px rgba(0,0,0,0.15))",
              }}
            >
              {t.hero.tagline}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-32 md:bottom-36 left-0 right-0 text-center px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div
              ref={promptCardRef}
              className="liquid-glass liquid-glass-dark rounded-2xl"
              style={{
                opacity: 0,
                transform: "translateY(40px)",
                transition: "opacity 400ms cubic-bezier(0.16,1,0.3,1), transform 2000ms cubic-bezier(0.16,1,0.3,1)",
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
                    className="w-full px-6 pt-5 pb-14 text-base text-left bg-transparent text-white placeholder:text-transparent focus:outline-none resize-none leading-relaxed font-input font-medium"
                    aria-label={t.hero.ariaLabel}
                  />
                  {!prompt && !isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none text-left">
                      <CyclingPlaceholder items={t.hero.placeholders} delay={4500} />
                    </div>
                  )}
                  {!prompt && isFocused && (
                    <div className="absolute top-5 left-6 right-20 text-base leading-relaxed pointer-events-none font-input font-medium text-white/95 text-left">
                      {t.hero.focusPlaceholder}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-3 right-3">
                  <div
                    ref={promptBtnRef}
                    style={{
                      opacity: 0,
                      transition: "opacity 1000ms cubic-bezier(0.16,1,0.3,1)",
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

            <div ref={promptPillsRef} className="flex flex-wrap justify-center gap-2 mt-4">
              {t.hero.suggestions.map((s) => {
                return (
                  <div
                    key={s.label}
                    className="liquid-glass liquid-glass-dark rounded-full"
                    style={{
                      opacity: 0,
                      transform: "translateY(12px)",
                      transition: "opacity 300ms cubic-bezier(0.16,1,0.3,1), transform 500ms cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPrompt(s.prompt)}
                      className="px-4 py-2 text-xs text-white/90 hover:text-white hover:bg-white/20 rounded-full transition-colors duration-200 font-sans"
                    >
                      {s.label}
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
