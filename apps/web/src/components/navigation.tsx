"use client"

import { useState, useEffect, useRef } from "react"
import { useI18n } from "@/lib/i18n"
import { useHeroEntrance } from "@/lib/hero-entrance"

export function Navigation() {
  const { locale, setLocale, t } = useI18n()
  const { mounted } = useHeroEntrance()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const hasScrolledRef = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      setPastHero(window.scrollY > window.innerHeight * 0.85)
      if (!hasScrolledRef.current && window.scrollY > 10) {
        hasScrolledRef.current = true
        setHasScrolled(true)
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navLinks = [
    { label: t.nav.howItWorks, href: "#como-funciona" },
    { label: t.nav.useCases, href: "#agentes" },
    { label: t.nav.earlyAccess, href: "#precios" },
    { label: t.nav.docs, href: "https://docs.struere.dev" },
  ]

  const toggleLocale = () => setLocale(locale === "es" ? "en" : "es")

  const textColor = pastHero ? "text-[#1B5B7A]" : "text-white"

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div
        className={`absolute inset-0 liquid-glass border-b border-white/15 ${hasScrolled ? "opacity-100" : "opacity-0"}`}
        style={{
          transitionProperty: "opacity",
          transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
          transitionDuration: "1200ms",
          boxShadow: pastHero
            ? "inset 0 1px 0 0 rgba(255,255,255,0.25), inset 0 -1px 0 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.1)"
            : "inset 0 1px 0 0 rgba(255,255,255,0.25), inset 0 -1px 0 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 md:px-12 flex items-center justify-between h-16">
        <div
          className={`ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "800ms",
          }}
        >
          <a
            href="#"
            className={`font-display text-xl font-semibold tracking-tight transition-colors duration-500 ${pastHero ? textColor : ""}`}
            style={pastHero ? {} : {
              backgroundImage: "linear-gradient(90deg, #4870a0, #5888b0, #80a8d0)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
            }}
          >
            Struere
          </a>
        </div>

        <div
          className={`hidden md:flex items-center gap-8 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasScrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "1200ms",
            ...(pastHero ? {} : {
              backgroundImage: "linear-gradient(90deg, #386090, #406898, #4870a0, #5078a0, #5880a8, #5078a0, #4870a0, #406898, #386090)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
            }),
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors duration-500 ${textColor}`}
              style={pastHero ? {} : {
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={toggleLocale}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors duration-500 cursor-pointer ${
              pastHero
                ? "text-[#1B5B7A]/60"
                : ""
            }`}
            style={pastHero ? {} : {
              color: "transparent",
              WebkitTextFillColor: "transparent",
            }}
          >
            {locale === "es" ? "EN" : "ES"}
          </button>
          <a
            href="https://app.struere.dev?studio="
            className={`text-sm font-medium px-5 py-2 rounded-xl transition-colors duration-500 border ${
              pastHero
                ? "text-white bg-[#1B5B7A] border-[#1B5B7A]"
                : "border-white/30"
            }`}
            style={pastHero ? {} : {
              color: "transparent",
              WebkitTextFillColor: "transparent",
            }}
          >
            {t.nav.cta}
          </a>
        </div>

        <div
          className={`md:hidden ease-[cubic-bezier(0.16,1,0.3,1)] ${hasScrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "1200ms",
          }}
        >
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-2 ${textColor} transition-colors duration-500`}
            aria-label="Menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 9h16.5m-16.5 6.75h16.5"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden liquid-glass border-t border-white/10">
          <div className="px-6 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`text-base ${textColor} transition-colors duration-500`}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={toggleLocale}
              className={`text-left text-base transition-colors duration-500 cursor-pointer ${
                pastHero
                  ? "text-[#1B5B7A]/60"
                  : "text-white/60"
              }`}
            >
              {locale === "es" ? "English" : "Espa\u00f1ol"}
            </button>
            <a
              href="https://app.struere.dev?studio="
              className={`mt-2 text-center text-sm font-medium px-5 py-3 rounded-xl transition-colors duration-500 border ${
                pastHero
                  ? "text-white bg-[#1B5B7A] border-[#1B5B7A]"
                  : "text-white border-white/30"
              }`}
            >
              {t.nav.cta}
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
