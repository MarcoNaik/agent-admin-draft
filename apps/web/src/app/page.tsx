"use client"

import React, { useState, useEffect, useRef, createContext, useContext } from "react"

type Mode = "builder" | "customer"

const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: "builder",
  setMode: () => {},
})

function useMode() {
  return useContext(ModeContext)
}

const modeContent = {
  builder: {
    hook: "Earn money building AI agents.",
    description:
      "We give you tools to build AI agents and sell them to small businesses. You describe what the agent does. We handle the tech. You set your price.",
    example: [
      "A therapist gets 20 WhatsApp messages a day. Scheduling, rescheduling, back and forth. Hours every week.",
      "You build her an agent. Patient texts, agent checks the calendar, books the appointment. Done.",
      "You charge $2,000. She pays ~$80/mo to run it. You find the next client.",
    ],
    closingBold: "That's it.",
    closing:
      "Restaurants, consultants, clinics — millions of small businesses drowning in repetitive tasks. They can't build this. Agencies charge $500/mo. You charge what you want.",
    requirementsHeader: "You don't need to code. You need:",
    requirements: [
      "Know what \"I'm drowning in scheduling\" means",
      "Describe what an agent should do in plain sentences",
      "Remember the clinic is closed Sundays",
    ],
    termsHeader: "Your terms",
    terms: [
      "Set your own price",
      "Client pays net maintenance cost (under $100/mo)",
      "Zero markup from Struere",
    ],
    cta: "Join waitlist → early access",
    stepsLabel: "Process",
    stepsHeader: "How it works",
    steps: [
      {
        number: "01",
        title: "Find a client",
        description:
          "Someone you know with repetitive tasks. Therapist, restaurant owner, consultant. Start with trust.",
      },
      {
        number: "02",
        title: "Understand the problem",
        description:
          "What eats their time? How do customers reach them? What tools do they use? What would solved look like?",
      },
      {
        number: "03",
        title: "Build the agent",
        description:
          "You describe what it does. Pre-built integrations for Google Calendar, WhatsApp, payments. Test until it works.",
      },
      {
        number: "04",
        title: "Deploy",
        description:
          "We host it. Connect to WhatsApp or wherever the business talks to customers. It runs.",
      },
      {
        number: "05",
        title: "Get paid",
        description:
          "Set your own price. Client pays net maintenance cost (under $100/mo) — zero markup from Struere.",
      },
      {
        number: "06",
        title: "Grow",
        description:
          "More agents for same client. Referrals. Specialize. This isn't passive income. It's a skill that compounds.",
      },
    ],
    realityLabel: "The reality",
    reality: [
      {
        title: "This is real",
        description:
          "Demand is growing. Small businesses need this. You can learn without coding. The economics work.",
      },
      {
        title: "This is also real",
        description:
          "You have to learn the skill. Finding clients takes effort. Details matter. It's a business, not passive income.",
      },
    ],
  },
  customer: {
    hook: "no more Bookings, reschedules, complaints.",
    description:
      "You run a team. Clients message to book. You check the spreadsheet, find a slot, reply. Repeat. All day. Every day. Now, what if you never had to touch that spreadsheet again?",
    example: [
      "You run a physio clinic with 8 therapists. Every morning starts the same. WhatsApp blowing up. Clients booking, rescheduling, asking if Thursday works. You check the spreadsheet. It's wrong again. Someone got double-booked last week.",
      "You hired a receptionist. She's overwhelmed too. You tried Calendly — your clients ignored it and kept messaging. You looked at AI agencies. $400/month. For that, you expected magic. You got a chatbot.",
      "Then you set up a Struere system. Clients text on WhatsApp, the agent checks real availability, books the slot, sends confirmation. You open a dashboard. Everyone's schedule. Today, tomorrow, next week. All there.",
    ],
    closingBold: "You set it up once.",
    closing:
      "Under $100/mo to run. Not a salary. Not an agency fee. Not a spreadsheet you maintain. A system that works while you focus on growing the business.",
    requirementsHeader: "You don't need to be technical. You need:",
    requirements: [
      "A team of 3–20 people doing the actual work",
      "Clients who already message you on WhatsApp",
      "Being done with duct-taping things together",
    ],
    termsHeader: "Simple pricing",
    terms: [
      "One-time setup cost — then it runs",
      "Under $100/mo. Actual infrastructure cost, no markup",
      "No contracts, no lock-in",
    ],
    cta: "Join waitlist → stop managing, start growing",
    stepsLabel: "Process",
    stepsHeader: "How it works",
    steps: [
      {
        number: "01",
        title: "Tell us how your business runs",
        description:
          "Who's on your team, how clients book, what breaks. 15 minutes.",
      },
      {
        number: "02",
        title: "We design your system",
        description:
          "Booking, scheduling, reminders. Fitted to how you already work.",
      },
      {
        number: "03",
        title: "A builder sets it up",
        description:
          "Connected to your WhatsApp. Tested with real clients. Until it works.",
      },
      {
        number: "04",
        title: "You open the dashboard",
        description:
          "Every booking, every schedule, every client. One screen. Updated automatically.",
      },
      {
        number: "05",
        title: "Your team focuses on clients",
        description:
          "No more WhatsApp tag. No more spreadsheet. Just the work.",
      },
      {
        number: "06",
        title: "Grow without more admin",
        description:
          "New hire? Add them to the system. New service? Add it. It scales with you.",
      },
    ],
    realityLabel: "The reality",
    reality: [
      {
        title: "What changes",
        description:
          "Clients book through WhatsApp automatically. Schedules update in real time. Reminders go out on their own. You see one dashboard instead of a spreadsheet with 47 tabs.",
      },
      {
        title: "What doesn't change",
        description:
          "Your team still does the work. You still run the business. This replaces the admin chaos, not your judgment.",
      },
    ],
  },
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("customer")

  useEffect(() => {
    const s = document.body.style
    s.backgroundColor = mode === "customer" ? "#F5F1E8" : "#0F2419"
    s.transition = "background-color 0.6s cubic-bezier(0.6, 0, 0.2, 1)"
  }, [mode])

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      <div data-mode={mode} className="font-source">
        <BlueprintBackground />
        <HeroSection />
        <HowItWorks />
        <RealitySection />
        <Footer />
        <ModeSwitcher />
      </div>
    </ModeContext.Provider>
  )
}

function ModeSwitcher() {
  const { mode, setMode } = useMode()

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="flex gap-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md">
        {(["customer", "builder"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span
              className={`size-1.5 inline-block rounded-full outline outline-1 outline-white outline-offset-1 transition-all duration-300 ${
                mode === m ? "bg-white" : "bg-transparent"
              }`}
            />
            <span className="text-[11px] text-white uppercase tracking-wider font-medium">
              {m}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BlueprintBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--bg-primary)",
          transition: "background-color 0.6s cubic-bezier(0.6, 0, 0.2, 1)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />
    </div>
  )
}

function TypewriterText({
  text,
  delay = 0,
}: {
  text: string
  delay?: number
}) {
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
        <span
          className="inline-block w-[2px] h-[0.85em] ml-1 animate-pulse"
          style={{ backgroundColor: "var(--text-primary)" }}
        />
      )}
    </span>
  )
}

function RevealText({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
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
  const { mode } = useMode()
  const c = modeContent[mode]
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
              <h1
                className="text-2xl md:text-3xl tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                <TypewriterText text="Struere" delay={300} />
              </h1>
            </div>
            <p
              className="text-[9px] tracking-[0.3em] uppercase opacity-70"
              style={{ color: "var(--text-accent)" }}
            >
              Agent Factory
            </p>
          </RevealText>

          <RevealText delay={200}>
            <p
              className="mt-14 text-sm md:text-base leading-relaxed max-w-md"
              style={{ color: "var(--text-primary)" }}
            >
              {c.hook}
            </p>
          </RevealText>

          <RevealText delay={300}>
            <p
              className="mt-6 text-[11px] leading-[1.95] max-w-md opacity-70"
              style={{ color: "var(--text-primary)" }}
            >
              {c.description}
            </p>
          </RevealText>

          <div
            className="mt-16 space-y-5 text-[11px] leading-[1.95] opacity-70"
            style={{ color: "var(--text-primary)" }}
          >
            <RevealText delay={400}>
              <p
                className="text-[9px] tracking-[0.3em] uppercase mb-4 opacity-70"
                style={{ color: "var(--text-accent)" }}
              >
                Example
              </p>
              <p>{c.example[0]}</p>
            </RevealText>

            <RevealText delay={500}>
              <p>{c.example[1]}</p>
            </RevealText>

            <RevealText delay={600}>
              <p>{c.example[2]}</p>
            </RevealText>

            <RevealText delay={700}>
              <p className="mt-8 opacity-100" style={{ color: "var(--text-primary)" }}>
                {c.closingBold}
              </p>
              <p className="mt-4">{c.closing}</p>
            </RevealText>
          </div>

          <RevealText delay={800}>
            <div
              className="mt-20 pt-12"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <p
                className="text-[9px] tracking-[0.3em] uppercase mb-10 opacity-70"
                style={{ color: "var(--text-accent)" }}
              >
                {c.requirementsHeader}
              </p>
              <div className="grid md:grid-cols-3 gap-8 text-[11px]">
                {c.requirements.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 opacity-80"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span
                      className="text-[10px] font-medium mt-px opacity-60"
                      style={{ color: "var(--text-accent)" }}
                    >
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
            <p
              className="text-[9px] tracking-[0.3em] uppercase mb-6 opacity-70"
              style={{ color: "var(--text-accent)" }}
            >
              {c.termsHeader}
            </p>
            <div className="space-y-3 mb-10">
              {c.terms.map((term, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-1 h-1"
                    style={{ backgroundColor: "var(--text-accent)" }}
                  />
                  <span
                    className="text-[11px] opacity-70"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {term}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3">
                <div
                  className="relative transition-all duration-300"
                  style={{
                    boxShadow: isFocused
                      ? "0 0 0 1px var(--text-accent)"
                      : "none",
                  }}
                >
                  <input
                    type="email"
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className="w-full border h-11 px-4 text-xs focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--input-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative font-medium whitespace-nowrap h-11 px-6 text-xs transition-all duration-300 disabled:opacity-70"
                  style={{
                    backgroundColor: isButtonHovered
                      ? "var(--btn-hover)"
                      : "var(--btn-bg)",
                    color: "var(--btn-text)",
                    letterSpacing: isButtonHovered ? "0.05em" : "normal",
                  }}
                  onMouseEnter={() => setIsButtonHovered(true)}
                  onMouseLeave={() => setIsButtonHovered(false)}
                >
                  {isLoading ? "Redirecting..." : c.cta}
                </button>
              </div>
            </form>
          </RevealText>
        </div>
      </div>
    </section>
  )
}

function StepCard({
  step,
  index,
}: {
  step: { number: string; title: string; description: string }
  index: number
}) {
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
          <span
            className="text-[10px] font-medium tracking-wider mt-0.5 opacity-70"
            style={{ color: "var(--text-accent)" }}
          >
            {step.number}
          </span>
          <div>
            <h3
              className="text-xs tracking-wide mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {step.title}
            </h3>
            <p
              className="text-[11px] leading-[1.9] opacity-70"
              style={{ color: "var(--text-primary)" }}
            >
              {step.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  const { mode } = useMode()
  const c = modeContent[mode]
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
    <section className="relative">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--bg-secondary)",
          transition: "background-color 0.6s cubic-bezier(0.6, 0, 0.2, 1)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line-strong) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line-strong) 1px, transparent 1px),
            linear-gradient(var(--grid-line-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line-subtle) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px, 80px 80px, 16px 16px, 16px 16px",
        }}
      />

      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ backgroundColor: "var(--border-subtle)" }}
      />

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-28">
        <div
          ref={headerRef}
          className={`mb-20 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="h-px w-8 opacity-50"
              style={{ backgroundColor: "var(--text-accent)" }}
            />
            <span
              className="text-[9px] tracking-[0.3em] uppercase opacity-70"
              style={{ color: "var(--text-accent)" }}
            >
              {c.stepsLabel}
            </span>
          </div>
          <h2
            className="text-lg tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {c.stepsHeader}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-x-20 gap-y-12">
          {c.steps.map((step, index) => (
            <StepCard key={`${mode}-${step.number}`} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

function RealityCard({
  title,
  description,
  delay,
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
      <h3
        className="text-xs tracking-wide mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p
        className="text-[11px] leading-[1.9] opacity-70"
        style={{ color: "var(--text-primary)" }}
      >
        {description}
      </p>
    </div>
  )
}

function RealitySection() {
  const { mode } = useMode()
  const c = modeContent[mode]
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
    <section className="relative">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--bg-secondary)",
          transition: "background-color 0.6s cubic-bezier(0.6, 0, 0.2, 1)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line-strong) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line-strong) 1px, transparent 1px),
            linear-gradient(var(--grid-line-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line-subtle) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px, 80px 80px, 16px 16px, 16px 16px",
        }}
      />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-24">
        <div
          ref={headerRef}
          className={`mb-14 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className="h-px w-8 opacity-50"
              style={{ backgroundColor: "var(--text-accent)" }}
            />
            <span
              className="text-[9px] tracking-[0.3em] uppercase opacity-70"
              style={{ color: "var(--text-accent)" }}
            >
              {c.realityLabel}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-16">
          {c.reality.map((card, i) => (
            <RealityCard
              key={`${mode}-${i}`}
              title={card.title}
              description={card.description}
              delay={i * 100}
            />
          ))}
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
    <footer ref={ref} className="relative">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--bg-secondary)",
          transition: "background-color 0.6s cubic-bezier(0.6, 0, 0.2, 1)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line-strong) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line-strong) 1px, transparent 1px),
            linear-gradient(var(--grid-line-subtle) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line-subtle) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px, 80px 80px, 16px 16px, 16px 16px",
        }}
      />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 md:px-8 py-20">
        <p
          className={`text-center text-[10px] tracking-wider transition-all duration-1000 ease-out opacity-70 ${
            isVisible ? "opacity-70 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ color: "var(--text-accent)" }}
        >
          Struere: Agent Factory — AI agents for small businesses, built by
          people like you.
        </p>
        <div
          className={`flex justify-center gap-6 mt-6 transition-all duration-1000 ease-out ${
            isVisible ? "opacity-50 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <a
            href="/privacy-policy"
            className="text-[10px] tracking-wider hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-accent)" }}
          >
            Privacy Policy
          </a>
          <a
            href="/terms-of-service"
            className="text-[10px] tracking-wider hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-accent)" }}
          >
            Terms of Service
          </a>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ backgroundColor: "var(--border-subtle)" }}
      />
    </footer>
  )
}
