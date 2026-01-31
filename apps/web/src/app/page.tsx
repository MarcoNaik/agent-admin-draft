"use client"

import React, { useState, useEffect, useRef } from "react"

export default function Home() {
  return (
    <div className="font-source">
      <BlueprintBackground />
      <HeroSection />
      <HowItWorks />
      <RealitySection />
      <Footer />
    </div>
  )
}

function BlueprintBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute inset-0 bg-[#F5F1E8]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(27, 67, 50, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  )
}

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayText, setDisplayText] = useState("")
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(startTimer)
  }, [delay])

  useEffect(() => {
    if (!started) return
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
        <span className="inline-block w-[2px] h-[0.85em] bg-[#1B4332] ml-1 animate-pulse" />
      )}
    </span>
  )
}

function RevealText({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

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

function HeroSection() {
  const [email, setEmail] = useState("")
  const [isButtonHovered, setIsButtonHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    window.location.href = "https://app.struere.dev"
  }

  return (
    <section className="relative w-full px-6 md:px-12 lg:pl-12 lg:pr-24 pt-28 md:pt-36 pb-28">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:gap-32">
        <div className="lg:max-w-xl">
          <RevealText>
            <div className="mb-1">
              <h1 className="text-2xl md:text-3xl text-[#1B4332] tracking-tight">
                <TypewriterText text="Struere" delay={300} />
              </h1>
            </div>
            <p className="text-[9px] text-[#2D5A45] tracking-[0.3em] uppercase opacity-70">
              Agent Factory
            </p>
          </RevealText>

          <RevealText delay={200}>
            <p className="mt-14 text-sm md:text-base text-[#1B4332] leading-relaxed max-w-md">
              Earn money building AI agents.
            </p>
          </RevealText>

          <RevealText delay={300}>
            <p className="mt-6 text-[11px] text-[#1B4332] leading-[1.95] max-w-md opacity-70">
              We give you tools to build AI agents and sell them to small businesses. You describe what the agent does. We handle the tech. You set your price.
            </p>
          </RevealText>

          <div className="mt-16 space-y-5 text-[#1B4332] text-[11px] leading-[1.95] opacity-70">
            <RevealText delay={400}>
              <p className="text-[9px] text-[#2D5A45] tracking-[0.3em] uppercase mb-4 opacity-70">
                Example
              </p>
              <p>
                A therapist gets 20 WhatsApp messages a day. Scheduling, rescheduling, back and forth. Hours every week.
              </p>
            </RevealText>

            <RevealText delay={500}>
              <p>
                You build her an agent. Patient texts, agent checks the calendar, books the appointment. Done.
              </p>
            </RevealText>

            <RevealText delay={600}>
              <p>
                You charge $2,000. She pays ~$80/mo to run it. You find the next client.
              </p>
            </RevealText>

            <RevealText delay={700}>
              <p className="text-[#1B4332] mt-8 opacity-100">
                {"That's it."}
              </p>
              <p className="mt-4">
                {"Restaurants, consultants, clinics — millions of small businesses drowning in repetitive tasks. They can't build this. Agencies charge $500/mo. You charge what you want."}
              </p>
            </RevealText>
          </div>

          <RevealText delay={800}>
            <div className="mt-20 pt-12 border-t border-[#2D5A45]/30">
              <p className="text-[9px] text-[#2D5A45] tracking-[0.3em] uppercase mb-10 opacity-70">
                {"You don't need to code. You need:"}
              </p>
              <div className="grid md:grid-cols-3 gap-8 text-[11px]">
                {[
                  "Know what \"I'm drowning in scheduling\" means",
                  "Describe what an agent should do in plain sentences",
                  "Remember the clinic is closed Sundays"
                ].map((item, i) => (
                  <div
                    key={i}
                    className="text-[#1B4332] flex items-start gap-3 opacity-80"
                  >
                    <span className="text-[#2D5A45] text-[10px] font-medium mt-px opacity-60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-[1.8]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </RevealText>
        </div>

        <div className="lg:max-w-sm lg:flex lg:flex-col lg:justify-end mt-20 lg:mt-0">
          <RevealText delay={900}>
            <p className="text-[9px] text-[#2D5A45] tracking-[0.3em] uppercase mb-6 opacity-70">Your terms</p>
            <div className="space-y-3 mb-10">
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 bg-[#2D5A45]" />
                <span className="text-[11px] text-[#1B4332] opacity-70">Set your own price</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 bg-[#2D5A45]" />
                <span className="text-[11px] text-[#1B4332] opacity-70">Client pays net maintenance cost (under $100/mo)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 bg-[#2D5A45]" />
                <span className="text-[11px] text-[#1B4332] opacity-70">Zero markup from Struere</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3">
                <div className={`relative transition-all duration-300 ${isFocused ? 'ring-1 ring-[#2D5A45]/50' : ''}`}>
                  <input
                    type="email"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className="w-full bg-[#FFFFFF] border border-[#2D5A45]/30 text-[#1B4332] placeholder:text-[#2D5A45]/50 h-11 px-4 text-xs focus:outline-none transition-colors"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`relative bg-[#1B4332] text-[#F5F1E8] font-medium whitespace-nowrap h-11 px-6 text-xs transition-all duration-300 hover:bg-[#2D5A45] disabled:opacity-70 ${
                    isButtonHovered ? "tracking-wider" : ""
                  }`}
                  onMouseEnter={() => setIsButtonHovered(true)}
                  onMouseLeave={() => setIsButtonHovered(false)}
                >
                  {isLoading ? "Redirecting..." : "Join waitlist → early access"}
                </button>
              </div>
            </form>
          </RevealText>
        </div>
      </div>
    </section>
  )
}

const steps = [
  {
    number: "01",
    title: "Find a client",
    description: "Someone you know with repetitive tasks. Therapist, restaurant owner, consultant. Start with trust."
  },
  {
    number: "02",
    title: "Understand the problem",
    description: "What eats their time? How do customers reach them? What tools do they use? What would solved look like?"
  },
  {
    number: "03",
    title: "Build the agent",
    description: "You describe what it does. Pre-built integrations for Google Calendar, WhatsApp, payments. Test until it works."
  },
  {
    number: "04",
    title: "Deploy",
    description: "We host it. Connect to WhatsApp or wherever the business talks to customers. It runs."
  },
  {
    number: "05",
    title: "Get paid",
    description: "Set your own price. Client pays net maintenance cost (under $100/mo) — zero markup from Struere."
  },
  {
    number: "06",
    title: "Grow",
    description: "More agents for same client. Referrals. Specialize. This isn't passive income. It's a skill that compounds."
  }
]

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 100)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [index])

  return (
    <div
      ref={ref}
      className={`relative transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="relative">
        <div className="flex items-start gap-4">
          <span className="text-[10px] text-[#2D5A45] font-medium tracking-wider mt-0.5 opacity-70">
            {step.number}
          </span>
          <div>
            <h3 className="text-xs text-[#1B4332] tracking-wide mb-2">
              {step.title}
            </h3>
            <p className="text-[11px] text-[#1B4332] leading-[1.9] opacity-70">
              {step.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  const [isVisible, setIsVisible] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    if (headerRef.current) observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative bg-[#E8E4D4]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(rgba(27, 67, 50, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
        }}
      />

      <div className="absolute top-0 left-0 right-0 h-px bg-[#2D5A45]/20" />

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-28">
        <div
          ref={headerRef}
          className={`mb-20 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px w-8 bg-[#2D5A45]/50" />
            <span className="text-[9px] text-[#2D5A45] tracking-[0.3em] uppercase opacity-70">
              Process
            </span>
          </div>
          <h2 className="text-lg text-[#1B4332] tracking-tight">
            How it works
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-x-20 gap-y-12">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

function RealityCard({
  title,
  description,
  delay
}: {
  title: string
  description: string
  delay: number
}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`relative transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <h3 className="text-xs text-[#1B4332] tracking-wide mb-3">
        {title}
      </h3>
      <p className="text-[11px] text-[#1B4332] leading-[1.9] opacity-70">
        {description}
      </p>
    </div>
  )
}

function RealitySection() {
  const [isVisible, setIsVisible] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    if (headerRef.current) observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative bg-[#E8E4D4]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(rgba(27, 67, 50, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
        }}
      />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="h-px bg-[#2D5A45]/20" />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-24">
        <div
          ref={headerRef}
          className={`mb-14 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="h-px w-8 bg-[#2D5A45]/50" />
            <span className="text-[9px] text-[#2D5A45] tracking-[0.3em] uppercase opacity-70">
              The reality
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-16">
          <RealityCard
            title="This is real"
            description="Demand is growing. Small businesses need this. You can learn without coding. The economics work."
            delay={0}
          />

          <RealityCard
            title="This is also real"
            description="You have to learn the skill. Finding clients takes effort. Details matter. It's a business, not passive income."
            delay={100}
          />
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <footer ref={ref} className="relative bg-[#E8E4D4]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.06) 1px, transparent 1px),
            linear-gradient(rgba(27, 67, 50, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 67, 50, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
        }}
      />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="h-px bg-[#2D5A45]/20" />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-20">
        <p className={`text-center text-[10px] text-[#2D5A45] tracking-wider transition-all duration-1000 ease-out opacity-70 ${
          isVisible ? "opacity-70 translate-y-0" : "opacity-0 translate-y-4"
        }`}>
          Struere: Agent Factory — AI agents for small businesses, built by people like you.
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#2D5A45]/20" />
    </footer>
  )
}
