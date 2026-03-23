"use client"

import { createContext, useContext, type ReactNode } from "react"

const translations = {
  nav: {
    howItWorks: "Features",
    useCases: "Demo",
    earlyAccess: "Pricing",
    docs: "Docs",
    cta: "Start free",
  },
  hero: {
    tagline: "BUILT FOR AI TO BUILD",
    headline: "AI agents for business",
    subheadline:
      "Describe what your business needs. AI builds the agents, the database, the integrations — all of it.",
    placeholders: [
      "A WhatsApp agent that handles bookings, payments, and calendar for a tutoring business...",
      "A customer support system with product database, order tracking, and escalation rules...",
      "A two-agent team — one takes restaurant orders, the other manages inventory...",
      "Payment collection with automatic reminders, retry logic, and role-based audit trail...",
    ],
    suggestions: [
      { label: "Client support", prompt: "A support agent for an online store that queries the product and order database, answers about shipping status, return policies, and available sizes. If the case is complex, escalate based on the agent's assigned role." },
      { label: "Bookings", prompt: "An agent for a dental practice that when a patient messages on WhatsApp, checks availability on Google Calendar, books the appointment, creates the patient record in the database, and sends a WhatsApp reminder 24 hours before." },
      { label: "Collections", prompt: "A trigger that when an invoice changes to 'overdue' status, sends a payment reminder via WhatsApp with the amount and payment link. If unpaid after 3 days, automatically retry. Track each attempt in the database." },
      { label: "Multi-agent", prompt: "A two-agent team for a restaurant: the first takes orders and reservations via WhatsApp, queries the menu database, and confirms availability. The second manages inventory and updates sold-out dishes. When a dish runs out, the second agent notifies the first." },
    ],
    createButton: "Try it free",
    focusPlaceholder: "What do you need to build...",
    ariaLabel: "What do you need to build",
    proofLine: "Free to start \u00b7 No credit card required",
  },
  howItWorks: {
    title: "Live in minutes.",
    steps: [
      {
        number: "01",
        title: "Describe what you need",
        description:
          "Tell Claude what your client needs: \"I need a WhatsApp agent that handles bookings and checks the calendar.\" Plain English. No flowcharts.",
      },
      {
        number: "02",
        title: "AI builds the system",
        description:
          "Claude creates the agent, defines its tools, sets up the database, and writes tests. You review everything from the dashboard.",
      },
      {
        number: "03",
        title: "Deploy and monitor",
        description:
          "Push to WhatsApp, web, or API. See every conversation in real time. Step in when you want.",
      },
    ],
  },
  useCases: {
    title: "Build any of these in minutes.",
    cases: [
      {
        icon: "\uD83D\uDCAC",
        title: "Client support",
        description:
          "Your client answers the same 50 questions a day. Build an agent that handles FAQs, order status, and returns \u2014 connected to their product database.",
        prompt:
          "A support agent for an online store with product and order lookup",
      },
      {
        icon: "\uD83D\uDCC5",
        title: "Booking systems",
        description:
          "Dental practice, tutoring business, salon \u2014 build a booking agent that checks Google Calendar, confirms slots, and sends WhatsApp reminders.",
        prompt: "A booking system for a dental practice with calendar sync",
      },
      {
        icon: "\uD83D\uDCB0",
        title: "Payment collection",
        description:
          "Overdue invoices pile up. Build an agent that sends reminders with payment links and follows up automatically.",
        prompt:
          "Payment reminders via WhatsApp 3 days before the due date",
      },
      {
        icon: "\uD83D\uDED2",
        title: "E-commerce",
        description:
          "Connect an agent to your client's catalog. It answers product questions, checks stock, and helps customers buy.",
        prompt:
          "A product advisor that queries inventory and helps with sizing",
      },
      {
        icon: "\uD83D\uDCCB",
        title: "Notifications",
        description:
          "When an order status changes, the agent notifies the customer and updates the database. No manual step.",
        prompt: "Notify the team on WhatsApp when an order is ready",
      },
      {
        icon: "\uD83E\uDD1D",
        title: "Multi-agent teams",
        description:
          "One agent takes orders. Another manages inventory. When a dish runs out, they coordinate automatically.",
        prompt:
          "A two-agent restaurant system for orders and inventory",
      },
    ],
    createAgent: "Build this \u2192",
  },
  integrations: {
    title: "Connects to what you already use.",
    aiModelsLabel: "Powered by",
    available: "Live",
    comingSoon: "",
    moreComingSoon: "",
  },
  earlyAccess: {
    title: "Get in before everyone else.",
    subtitle:
      "Everything you need to automate your business \u2014 free while we grow together.",
    badge: "Early access",
    price: "Free",
    priceNote: "during early access",
    features: [
      "Unlimited agents for any task",
      "WhatsApp Business with a real-time inbox",
      "Google Calendar \u2014 your agent books and manages appointments",
      "A database for your customers, orders, and products",
      "Agents that hand off to each other automatically",
      "Direct support from the founding team",
    ],
    cta: "Get early access",
    note: "No credit card \u00b7 Cancel anytime",
  },
  pricing: {
    title: "Always free with your own keys.",
    subtitle: "Bring your own API keys, or buy credits to skip the setup.",
    freeBadge: "For builders",
    freePrice: "$0",
    freePriceNote: "platform fee, forever",
    freeFeatures: [
      "Unlimited agents",
      "WhatsApp, Calendar, API",
      "Full developer toolkit",
      "Agents that work together",
      "See every conversation and action",
      "No platform fees",
    ],
    freeHow: "Use your own provider keys. You get the full toolkit \u2014 CLI, SDK, multi-agent, permissions. We don't charge anything.",
    freeCta: "Start for free",
    freeNote: "No credit card \u00b7 No commitment",
    managedTitle: "Not a developer?",
    managedNote: "Buy credits and use Studio from the browser. AI rates + 10%. No subscriptions.",
    tableInput: "Input",
    tableOutput: "Output",
    tableDefault: "Default",
    managedIncludes: "Studio, deployed agents, and testing \u2014 all included.",
    tableFooter: "40+ models supported.",
  },
  faq: {
    title: "Frequently asked questions.",
    subtitle: "Everything you need to know about Struere.",
    items: [
      {
        question: "What is Struere?",
        answer: "Struere is an AI agent platform for business automation. You describe what your business needs in natural language, and Struere builds AI agents that handle customer support, appointments, payments, and more \u2014 complete with a database, integrations, and multi-agent orchestration.",
      },
      {
        question: "Is Struere free?",
        answer: "Yes. Struere\u2019s platform is free forever when you bring your own API keys. You get unlimited agents, WhatsApp and Calendar integrations, the full developer toolkit, and no platform fees. You can also buy credits to skip API key setup.",
      },
      {
        question: "What integrations does Struere support?",
        answer: "Struere integrates with WhatsApp Business, Google Calendar, Airtable, email via Resend, and payment processing via Flow. It supports 40+ LLM models including GPT, Claude, Gemini, and Grok.",
      },
      {
        question: "How does multi-agent orchestration work?",
        answer: "Agents can communicate with each other using the agent.chat tool. You can build teams of specialized agents \u2014 for example, one handles orders while another manages inventory. Struere handles depth limits, cycle detection, and shared conversation context automatically.",
      },
      {
        question: "Do I need to code?",
        answer: "No. You can build and deploy agents entirely from the browser using Studio. For developers, Struere also offers a CLI and SDK for defining agents, data types, roles, and triggers in code.",
      },
    ],
  },
  cta: {
    title: "Build your first agent.",
    subtitle: "Describe what you need. It gets built.",
    createButton: "Try it free",
    focusPlaceholder: "What do you need to build...",
    ariaLabel: "What do you need to build",
  },
  footer: {
    columns: [
      {
        title: "Product",
        links: [
          { label: "How it works", href: "#how-it-works" },
          { label: "Use cases", href: "#use-cases" },
          { label: "Integrations", href: "#integrations" },
        ],
      },
      {
        title: "Resources",
        links: [
          {
            label: "Documentation",
            href: "https://docs.struere.dev",
          },
        ],
      },
      {
        title: "Contact",
        links: [
          { label: "Email", href: "mailto:hello@struere.dev" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Terms of service", href: "/terms-of-service" },
          { label: "Privacy policy", href: "/privacy-policy" },
        ],
      },
    ],
    madeWith: "",
  },
}

type Translations = typeof translations

interface I18nContextValue {
  t: Translations
}

const I18nContext = createContext<I18nContextValue>({
  t: translations,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ t: translations }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
