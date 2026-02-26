"use client"

import { motion } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"
import { useI18n } from "@/lib/i18n"

export function Footer() {
  const { t } = useI18n()
  const grid = useFadeSlideUp()
  const bottom = useFadeSlideUp()

  return (
    <footer className="bg-stone-card border-t border-charcoal/5">
      <div className="mx-auto max-w-5xl px-6 md:px-12 py-16 md:py-20">
        <motion.div
          ref={grid.ref}
          style={{ opacity: grid.opacity, y: grid.y, willChange: "transform, opacity" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
        >
          {t.footer.columns.map((column) => (
            <div key={column.title}>
              <h4 className="text-xs font-medium text-charcoal-heading tracking-wide mb-4">{column.title}</h4>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-charcoal/50 hover:text-charcoal transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        <motion.div
          ref={bottom.ref}
          style={{ opacity: bottom.opacity, willChange: "opacity" }}
          className="mt-16 pt-8 border-t border-charcoal/5 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <a href="#" className="font-display text-lg font-semibold text-charcoal-heading tracking-tight">
            Struere
          </a>

          <div className="flex items-center gap-5">
            <a href="mailto:hello@struere.dev" className="text-charcoal/30 hover:text-charcoal/60 transition-colors" aria-label="Email">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </a>
            <a href="#" className="text-charcoal/30 hover:text-charcoal/60 transition-colors" aria-label="Twitter">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
