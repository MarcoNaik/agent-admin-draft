"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useFadeSlideUp } from "@/hooks/use-scroll-animation"

const faqItems = [
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
]

function FAQItem({ question, answer, isOpen, onToggle }: { question: string; answer: string; isOpen: boolean; onToggle: () => void }) {
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

export function FAQ() {
  const { ref, opacity, y } = useFadeSlideUp()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-stone-base py-20 md:py-28">
      <motion.div ref={ref} style={{ opacity, y, willChange: "transform, opacity" }} className="mx-auto max-w-2xl px-6 md:px-12">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            Frequently asked questions.
          </h2>
          <p className="mt-4 text-base text-charcoal/60 max-w-lg mx-auto">Everything you need to know about Struere.</p>
        </div>

        <div className="rounded-2xl bg-white/80 border border-ocean/15 shadow-lg shadow-ocean/5 px-6 md:px-8">
          {faqItems.map((item, i) => (
            <FAQItem
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
