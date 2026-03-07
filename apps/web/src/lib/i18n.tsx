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
    tagline: "JUST DESCRIBE WHAT YOU NEED",
    headline: "AI agents for business automation",
    subheadline:
      "Tell Struere what your business needs in plain language. It creates AI agents that handle customer support, appointments, and payments \u2014 no flows, no drag-and-drop.",
    placeholders: [
      "A WhatsApp agent that answers my customers about shipping and returns...",
      "Book appointments on Google Calendar when patients message me on WhatsApp...",
      "Send payment reminders via WhatsApp 3 days before the due date...",
      "Take restaurant orders and reservations through WhatsApp...",
    ],
    suggestions: [
      { label: "Customer support", prompt: "A WhatsApp agent for my online store that queries the orders and products database to answer about shipping status, return policies, and available sizes. If the customer asks for a human or the case is complex, escalate based on the agent's assigned role." },
      { label: "Appointments", prompt: "An agent for my dental practice that when a patient messages on WhatsApp, checks availability on Google Calendar, books the appointment, creates the patient record in the database with treatment type and notes, and sends a WhatsApp reminder 24 hours before the appointment." },
      { label: "Collections", prompt: "A trigger that when an invoice in my database changes to 'overdue' status, sends a payment reminder via WhatsApp with the amount and payment link. If unpaid after 3 days, automatically retry. Log each attempt as an event and only let admins see the full history." },
      { label: "Orders", prompt: "A two-agent team for my restaurant: the first takes orders and reservations via WhatsApp, queries the menu database, and confirms availability. The second manages inventory and updates sold-out dishes. When a dish runs out, the second agent notifies the first to stop offering it." },
    ],
    createButton: "Try it free",
    focusPlaceholder: "Describe what your business needs...",
    ariaLabel: "Describe what your business needs",
    proofLine: "Free to start \u00b7 No credit card required",
  },
  howItWorks: {
    title: "Live in minutes.",
    steps: [
      {
        number: "01",
        title: "Describe what you need",
        description:
          "Write it like you'd tell a colleague: \"I need an agent that books appointments and checks my calendar.\" No code. No flowcharts.",
      },
      {
        number: "02",
        title: "Your agent is ready",
        description:
          "Struere creates a working agent that already knows your business \u2014 your products, your schedule, your rules. Adjust anything you want from the browser.",
      },
      {
        number: "03",
        title: "It goes live",
        description:
          "Deploy on WhatsApp, your website, or via API. Your agent replies to customers 24/7. You see every conversation in real time and step in when you want.",
      },
    ],
  },
  useCases: {
    title: "No more flowcharts. Just results.",
    cases: [
      {
        icon: "\uD83D\uDCAC",
        title: "Customer support",
        description:
          "Stop answering the same questions every day. Your agent handles FAQs, order status, and returns \u2014 you step in when it matters.",
        prompt:
          "An agent that answers questions about shipping and returns",
      },
      {
        icon: "\uD83D\uDCC5",
        title: "Appointments",
        description:
          "Patients or clients book directly on WhatsApp. Your agent checks Google Calendar, confirms the slot, and sends a reminder the day before.",
        prompt: "A booking system for my dental practice",
      },
      {
        icon: "\uD83D\uDCB0",
        title: "Collections",
        description:
          "Overdue invoice? Your agent sends a reminder with the amount and payment link. If unpaid, it follows up automatically.",
        prompt:
          "Payment reminders via WhatsApp 3 days before the due date",
      },
      {
        icon: "\uD83D\uDED2",
        title: "E-commerce",
        description:
          "Customers ask about products, sizes, or stock. Your agent answers from your catalog and helps them buy \u2014 no manual replies.",
        prompt:
          "An agent that helps my customers pick the right size",
      },
      {
        icon: "\uD83D\uDCCB",
        title: "Notifications & updates",
        description:
          "When an order changes status, your agent notifies the customer, updates your database, and schedules the next step.",
        prompt: "Send a WhatsApp to the team when an order changes to 'ready'",
      },
      {
        icon: "\uD83C\uDF7D\uFE0F",
        title: "Restaurants",
        description:
          "Take orders, confirm reservations, and answer menu questions \u2014 all handled by your agent, around the clock.",
        prompt:
          "A WhatsApp agent for my restaurant that takes orders",
      },
    ],
    createAgent: "Try this \u2192",
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
    title: "Free to start. Scale when you're ready.",
    subtitle: "Use your own AI provider keys for free, or buy credits to work from the browser.",
    freeBadge: "For developers",
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
    freeHow: "Connect your own AI provider (OpenAI, Anthropic, or xAI) and use the developer toolkit. You pay your provider directly \u2014 Struere charges nothing.",
    freeCta: "Start for free",
    freeNote: "No credit card \u00b7 No commitment",
    managedTitle: "Prefer the browser?",
    managedNote: "Buy credits and use Studio to create, test, and deploy agents \u2014 no setup needed. AI rates + 10%. No subscriptions.",
    tableInput: "Input",
    tableOutput: "Output",
    tableDefault: "Default",
    managedIncludes: "Studio, deployed agents, and testing \u2014 all included.",
    tableFooter: "40+ models supported.",
  },
  cta: {
    title: "Your next hire works 24/7.",
    subtitle: "Describe what you need. Your agent goes live in minutes.",
    createButton: "Try it free",
    focusPlaceholder: "Describe what your business needs...",
    ariaLabel: "Describe what your business needs",
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
