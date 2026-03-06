"use client"

import { createContext, useContext, type ReactNode } from "react"

const translations = {
  nav: {
    howItWorks: "How it works",
    useCases: "Use cases",
    earlyAccess: "Early access",
    docs: "Docs",
    cta: "Start free",
  },
  hero: {
    tagline: "AI AGENT PLATFORM",
    headline: "Think. Write. Build.",
    subheadline:
      "Describe what your business needs. Struere builds AI agents that handle it — no code, no hassle.",
    placeholders: [
      "A WhatsApp bot that answers my customers' FAQs...",
      "An agent that books appointments and sends automatic reminders...",
      "Payment reminders via WhatsApp 3 days before the due date...",
      "An assistant that manages reservations for my restaurant...",
    ],
    suggestions: [
      { label: "Customer support", prompt: "A WhatsApp agent for my online store that queries the orders and products database to answer about shipping status, return policies, and available sizes. If the customer asks for a human or the case is complex, escalate based on the agent's assigned role." },
      { label: "Scheduling", prompt: "An agent for my dental practice that when a patient messages on WhatsApp, checks availability on Google Calendar, books the appointment, creates the patient record in the database with treatment type and notes, and sends a WhatsApp reminder 24 hours before the appointment." },
      { label: "Billing", prompt: "A trigger that when an invoice in my database changes to 'overdue' status, sends a payment reminder via WhatsApp with the amount and payment link. If unpaid after 3 days, automatically retry. Log each attempt as an event and only let admins see the full history." },
      { label: "Reservations", prompt: "A two-agent team for my restaurant: the first takes orders and reservations via WhatsApp, queries the menu database, and confirms availability. The second manages inventory and updates sold-out dishes. When a dish runs out, the second agent notifies the first to stop offering it." },
    ],
    createButton: "Build it",
    focusPlaceholder: "Describe your agent...",
    ariaLabel: "Describe your agent",
    proofLine: "Free early access \u00b7 No credit card required",
  },
  howItWorks: {
    title: "Three steps. That\u2019s it.",
    steps: [
      {
        number: "01",
        title: "Describe your idea",
        description:
          "Write in plain language what you need. No coding required — just explain what you want your agent to do, like you'd explain it to a colleague.",
      },
      {
        number: "02",
        title: "Struere builds it",
        description:
          "Our AI models assemble a working agent with access to your database, WhatsApp, and calendar. Set up permissions, connect integrations, and deploy — all from the browser or CLI.",
      },
      {
        number: "03",
        title: "Launch and scale",
        description:
          "Your agent deploys instantly on WhatsApp or via our API. See every conversation in your inbox, step in when needed, and track usage and costs per agent.",
      },
    ],
  },
  useCases: {
    title: "What can you build?",
    cases: [
      {
        icon: "\uD83D\uDCAC",
        title: "Customer support",
        description:
          "WhatsApp bot that answers questions and resolves issues. When it needs help, you see it in your inbox and take over.",
        prompt:
          "An agent that answers questions about shipping and returns",
      },
      {
        icon: "\uD83D\uDCC5",
        title: "Automatic scheduling",
        description:
          "Agents that book appointments, send reminders, and handle cancellations hands-free.",
        prompt: "A booking system for my dental practice",
      },
      {
        icon: "\uD83D\uDCB0",
        title: "Collections & follow-up",
        description:
          "Agents that send payment reminders and follow up on overdue invoices automatically.",
        prompt:
          "Payment reminders via WhatsApp 3 days before the due date",
      },
      {
        icon: "\uD83D\uDED2",
        title: "E-commerce",
        description:
          "Assistants that answer product questions, take orders via WhatsApp, and help customers decide.",
        prompt:
          "An agent that helps my customers pick the right size",
      },
      {
        icon: "\uD83D\uDCCB",
        title: "Task automation",
        description:
          "When a record changes status, fire automatic actions: WhatsApp to the customer, data updates, and scheduled follow-ups with retries.",
        prompt: "Send a WhatsApp to the team when an order changes to 'ready'",
      },
      {
        icon: "\uD83C\uDF7D\uFE0F",
        title: "Restaurants",
        description:
          "Agents that take orders, confirm reservations, and answer questions about your menu.",
        prompt:
          "A WhatsApp agent for my restaurant that takes orders",
      },
    ],
    createAgent: "Build this agent",
  },
  integrations: {
    title: "Integrations",
    aiModelsLabel: "AI models",
    available: "Available",
    comingSoon: "",
    moreComingSoon: "",
  },
  earlyAccess: {
    title: "Free during early access",
    subtitle:
      "We're building something new. Get in early and help us shape it.",
    badge: "Early access",
    price: "Free",
    priceNote: "while we're in development",
    features: [
      "Unlimited agents",
      "WhatsApp Business with real-time inbox",
      "Google Calendar",
      "Your own business database",
      "Agent-to-agent delegation",
      "Direct support from the founding team",
    ],
    cta: "Join early access",
    note: "No credit card \u00b7 No commitment",
  },
  pricing: {
    title: "Two ways to build.",
    subtitle: "Use your own API keys for free, or buy credits to build from the browser with Studio.",
    freeBadge: "Bring your keys",
    freePrice: "$0",
    freePriceNote: "Struere fee, forever",
    freeFeatures: [
      "Unlimited agents",
      "WhatsApp, Calendar, API",
      "Local CLI development",
      "Agent-to-agent delegation",
      "Analytics & monitoring",
      "No platform fees",
    ],
    freeHow: "Install the CLI, connect your OpenAI, Anthropic, or xAI keys, and build locally. You pay your providers directly \u2014 Struere charges nothing.",
    freeCta: "Start with the CLI",
    freeNote: "No credit card \u00b7 No commitment",
    managedTitle: "Prefer to build from the browser?",
    managedNote: "Buy credits and use Studio, our built-in AI sandbox. Provider rates + 10% on LLM tokens only. No subscriptions, pay as you go.",
    tableInput: "Input",
    tableOutput: "Output",
    tableDefault: "Default",
    managedIncludes: "Studio, Deployed Agents, and Evals \u2014 all included with credits.",
    tableFooter: "40+ models supported.",
  },
  cta: {
    title: "What will you build?",
    subtitle: "Your next agent is one conversation away.",
    createButton: "Build it",
    focusPlaceholder: "Describe your agent...",
    ariaLabel: "Describe your agent",
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
    madeWith: "Made with \uD83E\uDD0D for LATAM",
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
