"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { Check, X, ChevronDown } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { useFadeSlideUp, useScaleIn } from "@/hooks/use-scroll-animation"

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "For exploring with your own keys",
    cta: "Get started free",
    href: "https://app.struere.dev",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$30",
    period: "/mo",
    description: "For teams building production agents",
    cta: "Start with Starter",
    href: "https://app.struere.dev",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$299",
    period: "/mo",
    description: "For scaling operations at enterprise level",
    cta: "Upgrade to Pro",
    href: "https://app.struere.dev",
    highlighted: false,
  },
]

type CellValue = boolean | string

interface FeatureRow {
  feature: string
  free: CellValue
  starter: CellValue
  pro: CellValue
}

interface FeatureCategory {
  category: string
  rows: FeatureRow[]
}

const featureTable: FeatureCategory[] = [
  {
    category: "Platform",
    rows: [
      { feature: "Agents", free: "3", starter: "Unlimited", pro: "Unlimited" },
      { feature: "Automations", free: "5", starter: "Unlimited", pro: "Unlimited" },
      { feature: "Eval suites", free: "1", starter: "Unlimited", pro: "Unlimited" },
      { feature: "Team members", free: "1", starter: "5", pro: "20" },
      { feature: "Weekly credits", free: "\u2014", starter: "$7.50", pro: "$75" },
      { feature: "Extra credit purchases", free: false, starter: true, pro: true },
    ],
  },
  {
    category: "AI Models",
    rows: [
      { feature: "Efficient models (GPT-5 Mini, Haiku)", free: true, starter: true, pro: true },
      { feature: "Standard models (GPT-5, Sonnet)", free: false, starter: true, pro: true },
      { feature: "Premium models (Opus, GPT-5 Pro)", free: false, starter: false, pro: true },
      { feature: "BYOK (Bring Your Own Key)", free: true, starter: true, pro: true },
      { feature: "40+ model support", free: true, starter: true, pro: true },
    ],
  },
  {
    category: "Integrations",
    rows: [
      { feature: "Web search & fetch", free: true, starter: true, pro: true },
      { feature: "WhatsApp connections", free: "1", starter: "5", pro: "Unlimited" },
      { feature: "Google Calendar", free: false, starter: true, pro: true },
      { feature: "Email (Resend)", free: false, starter: true, pro: true },
      { feature: "Airtable", free: true, starter: true, pro: true },
      { feature: "Payment processing", free: true, starter: true, pro: true },
    ],
  },
  {
    category: "Developer Tools",
    rows: [
      { feature: "SDK & CLI", free: true, starter: true, pro: true },
      { feature: "Multi-agent orchestration", free: false, starter: true, pro: true },
      { feature: "API access", free: true, starter: true, pro: true },
      { feature: "Real-time dashboard", free: true, starter: true, pro: true },
    ],
  },
  {
    category: "Support",
    rows: [
      { feature: "Community support", free: true, starter: true, pro: true },
      { feature: "Email support", free: false, starter: true, pro: true },
      { feature: "Priority support", free: false, starter: false, pro: true },
    ],
  },
]

const faqCategories = [
  {
    title: "Plans & Billing",
    items: [
      {
        question: "What is Struere?",
        answer: "Struere is an AI agent platform for business automation. You describe what your business needs in natural language, and Struere builds AI agents that handle customer support, appointments, payments, and more \u2014 complete with a database, integrations, and multi-agent orchestration.",
      },
      {
        question: "Is Struere free?",
        answer: "Yes. The Free plan gives you 3 agents, 5 automations, and full access to the developer toolkit with your own API keys. When you need more agents, integrations like WhatsApp and Calendar, or platform credits, paid plans start at $30/mo.",
      },
      {
        question: "How does billing work with multiple organizations?",
        answer: "Each organization is an independent billing entity with its own plan, credit balance, and invoices. If you belong to 3 organizations, each one pays for itself. Your personal membership doesn\u2019t affect billing \u2014 the organization pays based on its plan and usage.",
      },
      {
        question: "Can I have multiple free organizations?",
        answer: "You can only be admin of one free organization. This prevents abuse while keeping the free tier generous. You can be a member of unlimited free organizations, and admin of unlimited paid organizations.",
      },
      {
        question: "How do team members and seats work?",
        answer: "Each plan includes a set number of team seats \u2014 Free includes 1, Starter includes 5, and Pro includes 20. All team members get access to the organization\u2019s features based on the org\u2019s plan, not their personal plan.",
      },
      {
        question: "Can I upgrade or downgrade at any time?",
        answer: "Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period \u2014 you keep full access until then. Your agents and data are never deleted when changing plans.",
      },
    ],
  },
  {
    title: "Credits & Usage",
    items: [
      {
        question: "What are credits and how do they work?",
        answer: "Credits are the currency for AI usage on Struere. Every LLM call, WhatsApp message, and email send consumes credits from your organization\u2019s wallet. Paid plans include weekly credit allowances that reset automatically. You can also purchase extra credits that never expire.",
      },
      {
        question: "What does \u201CBring Your Own Key\u201D (BYOK) mean?",
        answer: "You can connect your own API keys from providers like OpenAI, Anthropic, Google, or xAI. When using your own keys, LLM calls don\u2019t consume Struere credits \u2014 you pay the provider directly. Tool costs like WhatsApp and email are still deducted from your credit balance.",
      },
      {
        question: "When do credits reset?",
        answer: "Subscription credits reset every 7 days automatically. If your credits run out before the reset, your agents will stop until credits are replenished \u2014 you can purchase extra credits at any time to keep them running.",
      },
      {
        question: "What happens when I run out of credits?",
        answer: "When your credit balance hits zero, your agents pause and return a message letting users know they\u2019re temporarily unavailable. You can purchase extra credits at any time to resume, or wait for your weekly credit reset.",
      },
      {
        question: "Do purchased credits expire?",
        answer: "No. Extra credits you purchase never expire and are non-refundable. They\u2019re only consumed after your weekly subscription credits are used up, so they act as a safety net for high-usage periods.",
      },
    ],
  },
  {
    title: "Features & Models",
    items: [
      {
        question: "Which AI models can I use?",
        answer: "Struere supports 40+ models across providers including OpenAI, Anthropic, Google, and xAI. All plans support efficient models like GPT-5 Mini and Claude Haiku. Starter unlocks standard models like GPT-5 and Claude Sonnet. Pro adds premium models like Claude Opus and GPT-5 Pro.",
      },
      {
        question: "Which integrations are included on each plan?",
        answer: "All plans include web tools, Airtable, and payment processing. Starter adds WhatsApp, email, Google Calendar, and multi-agent orchestration. All plans include the full SDK, CLI, and custom tool support.",
      },
      {
        question: "What\u2019s the difference between Starter and Pro?",
        answer: "Starter ($30/mo) is for builders getting started with production agents \u2014 5 WhatsApp connections, $7.50/week in credits, and 5 team members. Pro ($299/mo) is for scaling operations \u2014 unlimited WhatsApp, $75/week in credits, 20 team members, premium model access, and priority support.",
      },
      {
        question: "Do I need to code to use Struere?",
        answer: "No. You can build and deploy agents entirely from the browser using Studio. For developers, Struere also offers a CLI and SDK for defining agents, data types, roles, and triggers in code.",
      },
    ],
  },
]

function CellDisplay({ value }: { value: CellValue }) {
  if (value === true) {
    return <Check className="w-4 h-4 text-ocean mx-auto" strokeWidth={2.5} />
  }
  if (value === false) {
    return <X className="w-4 h-4 text-charcoal/20 mx-auto" strokeWidth={2} />
  }
  return <span className="text-sm text-charcoal/70">{value}</span>
}

function FAQItem({ question, answer, isOpen, onToggle }: { question: string; answer: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-charcoal/8 last:border-0">
      <button
        onClick={onToggle}
        className="cursor-pointer w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-sm md:text-base font-medium text-charcoal-heading pr-4">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-charcoal/30 flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-charcoal/60 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PricingContent() {
  const heroAnim = useFadeSlideUp()
  const cardsAnim = useScaleIn()
  const tableAnim = useFadeSlideUp()
  const faqAnim = useFadeSlideUp()
  const ctaAnim = useFadeSlideUp()
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  return (
    <div className="relative">
      <Navigation />

      <section className="bg-stone-base pt-32 pb-12 md:pt-40 md:pb-16">
        <motion.div
          ref={heroAnim.ref}
          style={{ opacity: heroAnim.opacity, y: heroAnim.y, willChange: "transform, opacity" }}
          className="mx-auto max-w-3xl px-6 md:px-12 text-center"
        >
          <nav className="mb-10">
            <Link
              href="/"
              className="text-sm text-charcoal/50 hover:text-charcoal transition-colors"
            >
              &larr; Home
            </Link>
          </nav>

          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-charcoal-heading">
            Pricing
          </h1>
          <p className="mt-4 text-lg text-charcoal/60 max-w-xl mx-auto">
            Start free with your own API keys. Add credits when you need them.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://app.struere.dev"
              className="inline-block text-center text-sm font-medium py-3 px-8 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors duration-200"
            >
              Get started free
            </a>
            <Link
              href="/contact"
              className="inline-block text-center text-sm font-medium py-3 px-8 rounded-xl border border-charcoal/15 text-charcoal/70 hover:text-charcoal hover:border-charcoal/30 transition-colors duration-200"
            >
              Contact sales
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="bg-stone-deep py-16 md:py-20">
        <motion.div
          ref={cardsAnim.ref}
          style={{ scale: cardsAnim.scale, opacity: cardsAnim.opacity, y: cardsAnim.y, willChange: "transform, opacity" }}
          className="mx-auto max-w-5xl px-6 md:px-12"
        >
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl bg-white/80 backdrop-blur p-8 border transition-shadow duration-200 ${
                  plan.highlighted
                    ? "border-ocean/30 shadow-lg shadow-ocean/10"
                    : "border-charcoal/8 hover:shadow-md hover:shadow-ocean/5"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-px left-8 right-8 h-[2px] bg-ocean rounded-full" />
                )}
                <span className="text-xs font-medium text-charcoal/40 uppercase tracking-wider">{plan.name}</span>
                <div className="flex items-baseline gap-1 mt-3 mb-2">
                  <span className="font-display text-4xl font-semibold text-charcoal-heading">{plan.price}</span>
                  {plan.period && <span className="text-sm text-charcoal/40">{plan.period}</span>}
                </div>
                <p className="text-sm text-charcoal/60 mb-6">{plan.description}</p>
                <a
                  href={plan.href}
                  className={`block text-center text-sm font-medium py-3 px-6 rounded-xl transition-colors duration-200 ${
                    plan.highlighted
                      ? "bg-ocean text-white hover:bg-ocean-light"
                      : "border border-charcoal/15 text-charcoal/70 hover:text-charcoal hover:border-charcoal/30"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="bg-stone-base py-16 md:py-24">
        <motion.div
          ref={tableAnim.ref}
          style={{ opacity: tableAnim.opacity, y: tableAnim.y, willChange: "transform, opacity" }}
          className="mx-auto max-w-5xl px-6 md:px-12"
        >
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
              Compare plans
            </h2>
            <p className="mt-4 text-base text-charcoal/60">
              Everything included at a glance.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-ocean/10">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-stone-deep">
                  <th className="text-left text-xs uppercase tracking-wider text-charcoal/50 font-medium py-4 px-5 w-[40%]">
                    Feature
                  </th>
                  <th className="text-center text-xs uppercase tracking-wider text-charcoal/50 font-medium py-4 px-4 w-[20%]">
                    Free
                  </th>
                  <th className="text-center text-xs uppercase tracking-wider text-ocean font-medium py-4 px-4 w-[20%] bg-ocean/[0.03]">
                    Starter
                  </th>
                  <th className="text-center text-xs uppercase tracking-wider text-charcoal/50 font-medium py-4 px-4 w-[20%]">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {featureTable.map((category) => (
                  <CategoryBlock key={category.category} category={category} />
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      <section className="bg-stone-deep py-16 md:py-24">
        <motion.div
          ref={faqAnim.ref}
          style={{ opacity: faqAnim.opacity, y: faqAnim.y, willChange: "transform, opacity" }}
          className="mx-auto max-w-4xl px-6 md:px-12"
        >
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-base text-charcoal/60 max-w-lg mx-auto">
              Everything you need to know about plans, credits, and billing.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {faqCategories.map((cat) => (
              <div key={cat.title} className="mb-8 last:mb-0">
                <h3 className="font-display text-lg font-medium text-charcoal-heading mb-4">{cat.title}</h3>
                <div className="rounded-2xl bg-white/80 border border-ocean/15 shadow-lg shadow-ocean/5 px-6 md:px-8">
                  {cat.items.map((item) => {
                    const key = `${cat.title}-${item.question}`
                    return (
                      <FAQItem
                        key={key}
                        question={item.question}
                        answer={item.answer}
                        isOpen={openFaq === key}
                        onToggle={() => setOpenFaq(openFaq === key ? null : key)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="bg-gradient-to-b from-stone-base to-stone-deep py-20 md:py-28">
        <motion.div
          ref={ctaAnim.ref}
          style={{ opacity: ctaAnim.opacity, y: ctaAnim.y, willChange: "transform, opacity" }}
          className="mx-auto max-w-2xl px-6 md:px-12 text-center"
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            Ready to get started?
          </h2>
          <p className="mt-4 text-base text-charcoal/60 max-w-md mx-auto">
            Build and deploy AI agents in minutes. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://app.struere.dev"
              className="inline-block text-center text-sm font-medium py-3 px-8 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors duration-200"
            >
              Get started free
            </a>
            <Link
              href="/contact"
              className="inline-block text-center text-sm font-medium py-3 px-8 rounded-xl border border-charcoal/15 text-charcoal/70 hover:text-charcoal hover:border-charcoal/30 transition-colors duration-200"
            >
              Contact sales
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}

function CategoryBlock({ category }: { category: FeatureCategory }) {
  return (
    <>
      <tr className="bg-stone-card">
        <td colSpan={4} className="font-medium text-charcoal-heading text-sm py-3 px-5">
          {category.category}
        </td>
      </tr>
      {category.rows.map((row, i) => (
        <tr
          key={row.feature}
          className={`border-b border-charcoal/5 hover:bg-stone-deep/50 transition-colors ${
            i % 2 === 1 ? "bg-stone-deep/30" : "bg-white"
          }`}
        >
          <td className="text-sm text-charcoal/70 py-3 px-5">{row.feature}</td>
          <td className="text-center py-3 px-4">
            <CellDisplay value={row.free} />
          </td>
          <td className="text-center py-3 px-4 bg-ocean/[0.03]">
            <CellDisplay value={row.starter} />
          </td>
          <td className="text-center py-3 px-4">
            <CellDisplay value={row.pro} />
          </td>
        </tr>
      ))}
    </>
  )
}
