"use client"

import { motion } from "motion/react"
import { Check } from "lucide-react"
import { useFadeSlideUp, useScaleIn } from "@/hooks/use-scroll-animation"

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    features: [
      "3 agents",
      "5 automations",
      "1 eval suite",
      "1 WhatsApp connection",
      "Bring your own API keys",
    ],
  },
  {
    name: "Starter",
    price: "$30",
    period: "/mo",
    highlighted: true,
    features: [
      "Unlimited agents, automations & evals",
      "5 WhatsApp connections",
      "$7.50/week in credits",
      "Up to 5 team members",
    ],
  },
  {
    name: "Pro",
    price: "$299",
    period: "/mo",
    features: [
      "Everything in Starter",
      "Unlimited WhatsApp",
      "$75/week in credits",
      "Up to 20 team members",
      "Priority support",
    ],
  },
]

export function Pricing() {
  const heading = useFadeSlideUp()
  const { ref, scale, opacity, y } = useScaleIn()

  return (
    <section id="pricing" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <motion.div ref={heading.ref} style={{ opacity: heading.opacity, y: heading.y, willChange: "transform, opacity" }} className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            Always free with your own keys.
          </h2>
          <p className="mt-4 text-base text-charcoal/60 max-w-lg mx-auto">Bring your own API keys, or add credits when you need them.</p>
        </motion.div>

        <motion.div
          ref={ref}
          style={{ scale, opacity, y, willChange: "transform, opacity" }}
          className="relative p-8 md:p-10 rounded-2xl bg-white/80 border border-ocean/15 shadow-lg shadow-ocean/5"
        >
          <div className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none">
            <div className="absolute inset-0 rounded-2xl prismatic-border opacity-20" />
          </div>

          <div className="relative grid md:grid-cols-3 gap-8 md:gap-0 md:divide-x md:divide-charcoal/10">
            {plans.map((plan) => (
              <div key={plan.name} className={`${plan.highlighted ? "md:px-8" : "md:px-8 first:md:pl-0 last:md:pr-0"}`}>
                <span className="text-xs font-medium text-charcoal/40 uppercase tracking-wider">{plan.name}</span>

                <div className="flex items-baseline gap-1 mt-3 mb-4">
                  <span className="font-display text-4xl font-semibold text-charcoal-heading">{plan.price}</span>
                  {plan.period && <span className="text-sm text-charcoal/40">{plan.period}</span>}
                </div>

                <div className="space-y-2.5 mb-6">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-ocean flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="text-sm text-charcoal/70">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.highlighted && (
                  <a
                    href="https://app.struere.dev"
                    className="inline-block text-center text-sm font-medium py-3 px-8 rounded-xl bg-ocean text-white hover:bg-ocean-light transition-colors duration-200"
                  >
                    Get started
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="relative mt-8 pt-6 border-t border-charcoal/10">
            <p className="text-xs text-charcoal/40 leading-relaxed">
              All plans include BYOK support, full SDK & CLI, and 40+ AI models. Credits reset weekly. Extra credits never expire.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
