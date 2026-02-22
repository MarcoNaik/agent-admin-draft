"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n"
import { useHeroEntrance } from "@/lib/hero-entrance"

export function Navigation() {
  const { locale, setLocale, t } = useI18n()
  const mounted = useHeroEntrance()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setPastHero(window.scrollY > window.innerHeight * 0.85)
      if (!hasScrolled && window.scrollY > 10) setHasScrolled(true)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [hasScrolled])

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
            className={`font-display text-xl font-semibold tracking-tight ${textColor} transition-colors duration-500`}
          >
            Struere
          </a>
        </div>

        <div
          className={`hidden md:flex items-center gap-8 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasScrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "1200ms",
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm ${textColor} hover:opacity-80 transition-all duration-500`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div
          className={`hidden md:flex items-center gap-4 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasScrolled ? "opacity-100" : "opacity-0"}`}
          style={{
            transitionProperty: "opacity",
            transitionDuration: "1200ms",
          }}
        >
          <button
            onClick={toggleLocale}
            className={`text-xs font-medium px-2 py-1 rounded transition-all duration-500 cursor-pointer ${
              pastHero
                ? "text-[#1B5B7A]/60 hover:text-[#1B5B7A]"
                : "text-white/60 hover:text-white"
            }`}
          >
            {locale === "es" ? "EN" : "ES"}
          </button>
          <a
            href="https://app.struere.dev?studio="
            className={`text-sm font-medium px-5 py-2 rounded-xl transition-all duration-500 border ${
              pastHero
                ? "text-white bg-[#1B5B7A] border-[#1B5B7A] hover:bg-[#1B4F72] hover:border-[#1B4F72]"
                : "text-white border-white/30 hover:bg-white/10 hover:border-white/50"
            }`}
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
                className={`text-base ${textColor} hover:opacity-80 transition-all duration-500`}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={toggleLocale}
              className={`text-left text-base transition-all duration-500 cursor-pointer ${
                pastHero
                  ? "text-[#1B5B7A]/60 hover:text-[#1B5B7A]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {locale === "es" ? "English" : "Espa\u00f1ol"}
            </button>
            <a
              href="https://app.struere.dev?studio="
              className={`mt-2 text-center text-sm font-medium px-5 py-3 rounded-xl transition-all duration-500 border ${
                pastHero
                  ? "text-white bg-[#1B5B7A] border-[#1B5B7A] hover:bg-[#1B4F72]"
                  : "text-white border-white/30 hover:bg-white/10"
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
