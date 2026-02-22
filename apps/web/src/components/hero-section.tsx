"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { useReveal } from "@/hooks/use-reveal"

const suggestions = [
  "Schedule appointments via WhatsApp",
  "Answer customer questions 24/7",
  "Send booking reminders",
  "Collect payments after sessions",
]

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayText, setDisplayText] = useState("")
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    if (prefersReduced) {
      setDisplayText(text)
      setStarted(true)
      return
    }
    const startTimer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(startTimer)
  }, [delay, text])

  useEffect(() => {
    if (!started) return
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    if (prefersReduced) {
      setDisplayText(text)
      return
    }
    let i = 0
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(timer)
      }
    }, 60)
    return () => clearInterval(timer)
  }, [text, started])

  return (
    <span>
      {displayText}
      {started && displayText.length < text.length && (
        <span className="inline-block w-[2px] h-[0.85em] ml-1 animate-pulse bg-white" />
      )}
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
      className={`transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      }`}
    >
      {children}
    </div>
  )
}

export function HeroSection() {
  const [prompt, setPrompt] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    window.location.href = "https://app.struere.dev"
  }

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center">
      <Image
        src="/hero-bg.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />

      <div className="relative w-full max-w-3xl mx-auto px-6 md:px-12 text-center">
        <RevealBlock>
          <p className="text-[9px] tracking-[0.3em] uppercase text-white/50 mb-2">
            <TypewriterText text="Struere" delay={300} />
          </p>
        </RevealBlock>

        <RevealBlock delay={200}>
          <h1 className="text-3xl md:text-5xl lg:text-6xl tracking-tight text-white font-light leading-tight">
            You describe it.
            <br />
            We build it.
          </h1>
        </RevealBlock>

        <RevealBlock delay={400}>
          <p className="mt-6 text-sm md:text-base text-white/60 max-w-lg mx-auto leading-relaxed">
            Tell us what your agent should do — book appointments, answer WhatsApp messages, take payments. It ships in minutes.
          </p>
        </RevealBlock>

        <RevealBlock delay={600}>
          <form onSubmit={handleSubmit} className="mt-12">
            <div
              className={`relative bg-white/10 backdrop-blur-xl border rounded-2xl transition-all duration-300 ${
                isFocused
                  ? "border-white/40 shadow-lg shadow-white/5"
                  : "border-white/20"
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
                placeholder="An agent that schedules appointments from WhatsApp and sends reminders..."
                rows={3}
                className="w-full px-6 pt-5 pb-14 text-sm md:text-base bg-transparent text-white placeholder:text-white/30 focus:outline-none resize-none leading-relaxed"
              />
              <div className="absolute bottom-3 right-3">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium tracking-wide bg-white/90 hover:bg-white text-forest rounded-xl transition-all duration-200"
                >
                  Build this →
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrompt(s)}
                  className="px-3 py-1.5 text-[11px] text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </form>
        </RevealBlock>

        <RevealBlock delay={800}>
          <p className="mt-8 text-[11px] text-white/40">
            Free to start. No code involved.
          </p>
        </RevealBlock>
      </div>
    </section>
  )
}
