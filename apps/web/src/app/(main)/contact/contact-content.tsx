"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Mail } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

export function ContactContent() {
  const header = useFadeSlideUp()
  const info = useFadeSlideUp()
  const form = useFadeSlideUp()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [isFocused, setIsFocused] = useState<string | null>(null)

  return (
    <div className="relative">
      <Navigation />

      <section className="bg-stone-base pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-3xl px-6 md:px-12 text-center">
          <motion.div
            ref={header.ref}
            style={{ opacity: header.opacity, y: header.y, willChange: "transform, opacity" }}
          >
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-charcoal-heading">
              Get in touch
            </h1>
            <p className="mt-4 text-lg text-charcoal/60 max-w-xl mx-auto">
              Have a question, partnership idea, or just want to say hello? We&rsquo;d love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-stone-base py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-16 md:gap-12">
            <motion.div
              ref={info.ref}
              style={{ opacity: info.opacity, y: info.y, willChange: "transform, opacity" }}
              className="md:col-span-2 space-y-8"
            >
              <div>
                <h2 className="font-display text-lg font-medium text-charcoal-heading mb-4">
                  Contact info
                </h2>
                <div className="space-y-4">
                  <a
                    href="mailto:marco@struere.dev"
                    className="flex items-center gap-3 text-charcoal/70 hover:text-charcoal transition-colors"
                  >
                    <Mail className="w-4 h-4 text-ocean" strokeWidth={1.5} />
                    <span className="text-sm">marco@struere.dev</span>
                  </a>
                  <a
                    href="https://x.com/StruereAI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-charcoal/70 hover:text-charcoal transition-colors"
                  >
                    <svg className="w-4 h-4 text-ocean" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="text-sm">@StruereAI</span>
                  </a>
                  <a
                    href="https://linkedin.com/company/struere-ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-charcoal/70 hover:text-charcoal transition-colors"
                  >
                    <svg className="w-4 h-4 text-ocean" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    <span className="text-sm">struere-ai</span>
                  </a>
                  <a
                    href="https://youtube.com/@struere-ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-charcoal/70 hover:text-charcoal transition-colors"
                  >
                    <svg className="w-4 h-4 text-ocean" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <span className="text-sm">@struere-ai</span>
                  </a>
                </div>
              </div>

              <div>
                <h2 className="font-display text-lg font-medium text-charcoal-heading mb-2">
                  Response time
                </h2>
                <p className="text-sm text-charcoal/60 leading-relaxed">
                  We typically respond within 24 hours on business days.
                </p>
              </div>
            </motion.div>

            <motion.div
              ref={form.ref}
              style={{ opacity: form.opacity, y: form.y, willChange: "transform, opacity" }}
              className="md:col-span-3"
            >
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-charcoal-heading tracking-wide mb-2">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setIsFocused("name")}
                    onBlur={() => setIsFocused(null)}
                    className={`w-full px-4 py-3 text-sm bg-white/60 backdrop-blur-xl rounded-xl text-charcoal placeholder:text-charcoal/25 focus:outline-none transition-shadow duration-300 border border-charcoal/5 ${
                      isFocused === "name" ? "shadow-lg shadow-ocean/10 border-ocean/20" : ""
                    }`}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-charcoal-heading tracking-wide mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsFocused("email")}
                    onBlur={() => setIsFocused(null)}
                    className={`w-full px-4 py-3 text-sm bg-white/60 backdrop-blur-xl rounded-xl text-charcoal placeholder:text-charcoal/25 focus:outline-none transition-shadow duration-300 border border-charcoal/5 ${
                      isFocused === "email" ? "shadow-lg shadow-ocean/10 border-ocean/20" : ""
                    }`}
                    placeholder="you@company.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-medium text-charcoal-heading tracking-wide mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={() => setIsFocused("message")}
                    onBlur={() => setIsFocused(null)}
                    rows={5}
                    className={`w-full px-4 py-3 text-sm bg-white/60 backdrop-blur-xl rounded-xl text-charcoal placeholder:text-charcoal/25 focus:outline-none resize-none transition-shadow duration-300 border border-charcoal/5 leading-relaxed ${
                      isFocused === "message" ? "shadow-lg shadow-ocean/10 border-ocean/20" : ""
                    }`}
                    placeholder="How can we help?"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-8 py-3 text-sm font-medium bg-ocean text-white hover:bg-ocean-light rounded-xl transition-colors duration-200"
                  >
                    Send message &rarr;
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
