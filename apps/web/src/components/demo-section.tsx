"use client"

import { useState, useEffect, useRef } from "react"
import { useReveal } from "@/hooks/use-reveal"
import { useI18n } from "@/lib/i18n"

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-charcoal/8 bg-stone-base shadow-xl shadow-charcoal/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-deep/80 border-b border-charcoal/5">
        <div className="w-2.5 h-2.5 rounded-full bg-charcoal/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-charcoal/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-charcoal/10" />
        <div className="flex-1 mx-8">
          <div className="h-5 rounded-md bg-charcoal/5 max-w-[200px] mx-auto" />
        </div>
      </div>
      <div className="relative p-6 md:p-8 min-h-[320px] md:min-h-[360px]">
        {children}
      </div>
    </div>
  )
}

function TypingStep({ text, charIndex }: { text: string; charIndex: number }) {
  const displayed = text.slice(0, charIndex)
  const showCursor = charIndex < text.length

  return (
    <div className="text-sm md:text-base text-charcoal/80 font-mono leading-relaxed">
      {displayed}
      {showCursor && (
        <span className="inline-block w-[2px] h-[1em] ml-0.5 bg-ocean animate-pulse" />
      )}
    </div>
  )
}

function BuildStep({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <span className="text-ocean text-sm">&#10003;</span>
      <span className="text-sm text-charcoal/70">{label}</span>
    </div>
  )
}

function ChatBubble({
  from,
  text,
  agentName,
  visible,
}: {
  from: "customer" | "agent"
  text: string
  agentName: string
  visible: boolean
}) {
  const isAgent = from === "agent"
  return (
    <div
      className={`flex transition-all duration-500 ${
        isAgent ? "justify-start" : "justify-end"
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
    >
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isAgent
            ? "bg-ocean/10 text-charcoal/80 rounded-bl-md"
            : "bg-charcoal/5 text-charcoal/70 rounded-br-md"
        }`}
      >
        {isAgent && (
          <span className="block text-[10px] font-medium text-ocean/60 mb-1">
            {agentName}
          </span>
        )}
        {text}
      </div>
    </div>
  )
}

export function DemoSection() {
  const { t } = useI18n()
  const { ref, isVisible } = useReveal({ threshold: 0.2 })
  const [phase, setPhase] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [buildVisible, setBuildVisible] = useState<boolean[]>([
    false,
    false,
    false,
    false,
  ])
  const [chatVisible, setChatVisible] = useState<boolean[]>([false, false])
  const [paused, setPaused] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const promptText = t.demo.promptText

  useEffect(() => {
    if (!isVisible) return
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (prefersReduced) {
      setPhase(2)
      setCharIndex(promptText.length)
      setBuildVisible([true, true, true, true])
      setChatVisible([true, true])
      return
    }

    let cancelled = false

    async function runDemo() {
      while (!cancelled) {
        setPhase(0)
        setCharIndex(0)
        setBuildVisible([false, false, false, false])
        setChatVisible([false, false])

        for (let i = 0; i <= promptText.length; i++) {
          if (cancelled) return
          await new Promise((r) => setTimeout(r, 40))
          setCharIndex(i)
        }

        await new Promise((r) => setTimeout(r, 800))
        if (cancelled) return

        setPhase(1)
        for (let i = 0; i < 4; i++) {
          if (cancelled) return
          await new Promise((r) => setTimeout(r, 500))
          setBuildVisible((prev) => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }

        await new Promise((r) => setTimeout(r, 800))
        if (cancelled) return

        setPhase(2)
        for (let i = 0; i < 2; i++) {
          if (cancelled) return
          await new Promise((r) => setTimeout(r, 600))
          setChatVisible((prev) => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }

        await new Promise((r) => setTimeout(r, 3000))
        if (cancelled) return
      }
    }

    runDemo()
    return () => {
      cancelled = true
    }
  }, [isVisible, promptText])

  return (
    <section className="bg-stone-base py-20 md:py-28">
      <div ref={ref} className="mx-auto max-w-3xl px-6 md:px-12">
        <div
          className={`text-center mb-12 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            {t.demo.title}
          </h2>
        </div>

        <div
          className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <BrowserFrame>
            <div
              className={`transition-opacity duration-500 ${
                phase === 0
                  ? "opacity-100"
                  : "opacity-0 absolute inset-6 md:inset-8"
              }`}
            >
              <p className="text-xs text-charcoal/40 mb-3 font-sans">
                {t.demo.describeLabel}
              </p>
              <TypingStep text={promptText} charIndex={charIndex} />
            </div>

            <div
              className={`transition-opacity duration-500 ${
                phase === 1
                  ? "opacity-100"
                  : "opacity-0 absolute inset-6 md:inset-8"
              }`}
            >
              <p className="text-xs text-charcoal/40 mb-4 font-sans">
                {t.demo.buildingLabel}
              </p>
              <div className="flex flex-col gap-3">
                {t.demo.buildSteps.map((step, i) => (
                  <BuildStep key={step} label={step} visible={buildVisible[i]} />
                ))}
              </div>
            </div>

            <div
              className={`transition-opacity duration-500 ${
                phase === 2
                  ? "opacity-100"
                  : "opacity-0 absolute inset-6 md:inset-8"
              }`}
            >
              <p className="text-xs text-charcoal/40 mb-4 font-sans">
                {t.demo.activeLabel}
              </p>
              <div className="flex flex-col gap-3">
                <ChatBubble
                  from="customer"
                  text={t.demo.customerMessage}
                  agentName={t.demo.agentName}
                  visible={chatVisible[0]}
                />
                <ChatBubble
                  from="agent"
                  text={t.demo.agentMessage}
                  agentName={t.demo.agentName}
                  visible={chatVisible[1]}
                />
              </div>
            </div>
          </BrowserFrame>

          <div className="text-center mt-8">
            <a
              href="https://app.struere.dev?studio="
              className="inline-block text-sm font-medium text-ocean hover:text-ocean-light transition-colors"
            >
              {t.demo.tryIt} &rarr;
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
