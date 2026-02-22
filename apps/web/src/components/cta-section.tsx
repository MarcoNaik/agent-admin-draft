"use client"

import { useState } from "react"
import { useReveal } from "@/hooks/use-reveal"

export function CTASection() {
  const { ref, isVisible } = useReveal({ threshold: 0.2 })
  const [prompt, setPrompt] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    window.location.href = "https://app.struere.dev"
  }

  return (
    <section className="relative bg-cream py-28 md:py-36">
      <div ref={ref} className="mx-auto max-w-2xl px-6 md:px-12 text-center">
        <div
          className={`transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <h2 className="text-2xl md:text-3xl tracking-tight text-forest font-light mb-4">
            Ready to build yours?
          </h2>
          <p className="text-sm text-forest-accent/60 mb-10">
            Just describe what you need.
          </p>

          <form onSubmit={handleSubmit}>
            <div
              className={`relative bg-cream-card border rounded-2xl transition-all duration-300 ${
                isFocused
                  ? "border-forest/30 shadow-lg shadow-forest/5"
                  : "border-forest/10"
              }`}
            >
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
                placeholder="A support agent that handles FAQs and routes tricky questions to your team..."
                rows={3}
                className="w-full px-6 pt-5 pb-14 text-sm bg-transparent text-forest placeholder:text-forest-accent/30 focus:outline-none resize-none leading-relaxed"
              />
              <div className="absolute bottom-3 right-3">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium tracking-wide bg-forest hover:bg-forest-accent text-cream rounded-xl transition-all duration-200"
                >
                  Start building →
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
