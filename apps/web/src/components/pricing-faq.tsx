"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

const pricingFaqItems = [
  {
    question: "What is Struere?",
    answer: "Struere is an AI agent platform for business automation. You describe what your business needs in natural language, and Struere builds AI agents that handle customer support, appointments, payments, and more \u2014 complete with a database, integrations, and multi-agent orchestration.",
  },
  {
    question: "Is Struere free?",
    answer: "Yes. The Free plan gives you 3 agents, 5 automations, and full access to the developer toolkit with your own API keys. When you need more agents, integrations like WhatsApp and Calendar, or platform credits, paid plans start at $30/mo.",
  },
  {
    question: "What are credits and how do they work?",
    answer: "Credits are the currency for AI usage on Struere. Every LLM call, WhatsApp message, and email send consumes credits from your organization\u2019s wallet. Paid plans include weekly credit allowances that reset automatically. You can also purchase extra credits that never expire.",
  },
  {
    question: "What does \u201CBring Your Own Key\u201D (BYOK) mean?",
    answer: "You can connect your own API keys from providers like OpenAI, Anthropic, Google, or xAI. When using your own keys, LLM calls don\u2019t consume Struere credits \u2014 you pay the provider directly. Tool costs like WhatsApp and email are still deducted from your credit balance.",
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
    question: "When do credits reset?",
    answer: "Subscription credits reset every 7 days automatically. If your credits run out before the reset, your agents will stop until credits are replenished \u2014 you can purchase extra credits at any time to keep them running.",
  },
  {
    question: "What happens when I run out of credits?",
    answer: "When your credit balance hits zero, your agents pause and return a message letting users know they\u2019re temporarily unavailable. You can purchase extra credits at any time to resume, or wait for your weekly credit reset.",
  },
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
    question: "Can I upgrade or downgrade at any time?",
    answer: "Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period \u2014 you keep full access until then. Your agents and data are never deleted when changing plans.",
  },
  {
    question: "Do purchased credits expire?",
    answer: "No. Extra credits you purchase never expire and are non-refundable. They\u2019re only consumed after your weekly subscription credits are used up, so they act as a safety net for high-usage periods.",
  },
  {
    question: "Do I need to code to use Struere?",
    answer: "No. You can build and deploy agents entirely from the browser using Studio. For developers, Struere also offers a CLI and SDK for defining agents, data types, roles, and triggers in code.",
  },
]

function PricingFAQItem({ question, answer, isOpen, onToggle }: { question: string; answer: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-charcoal/8 last:border-0">
      <button
        onClick={onToggle}
        className="cursor-pointer w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-sm md:text-base font-medium text-charcoal-heading pr-4">{question}</span>
        <svg
          className={`w-4 h-4 text-charcoal/30 flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
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

export function PricingFAQ() {
  const { ref, opacity, y } = useFadeSlideUp()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-stone-base py-20 md:py-28">
      <motion.div ref={ref} style={{ opacity, y, willChange: "transform, opacity" }} className="mx-auto max-w-2xl px-6 md:px-12">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            Pricing FAQ
          </h2>
          <p className="mt-4 text-base text-charcoal/60 max-w-lg mx-auto">Everything you need to know about plans, credits, and billing.</p>
        </div>

        <div className="rounded-2xl bg-white/80 border border-ocean/15 shadow-lg shadow-ocean/5 px-6 md:px-8">
          {pricingFaqItems.map((item, i) => (
            <PricingFAQItem
              key={i}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </motion.div>
    </section>
  )
}
