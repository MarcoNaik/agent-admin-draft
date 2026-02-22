"use client"

import { useReveal } from "@/hooks/use-reveal"

const plans = [
  {
    name: "Gratis",
    price: "$0",
    period: "/mes",
    badge: null,
    featured: false,
    features: [
      { text: "1 agente", included: true },
      { text: "100 mensajes/mes", included: true },
      { text: "Integraciones basicas", included: true },
      { text: "Soporte comunitario", included: true },
      { text: "Analytics", included: false },
      { text: "API access", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "USD/mes",
    badge: "Mas popular",
    featured: true,
    features: [
      { text: "5 agentes", included: true },
      { text: "5,000 mensajes/mes", included: true },
      { text: "Todas las integraciones", included: true },
      { text: "Soporte prioritario", included: true },
      { text: "Analytics", included: true },
      { text: "API access", included: false },
    ],
  },
  {
    name: "Equipo",
    price: "$49",
    period: "USD/mes",
    badge: null,
    featured: false,
    features: [
      { text: "Agentes ilimitados", included: true },
      { text: "Mensajes ilimitados", included: true },
      { text: "Todas las integraciones", included: true },
      { text: "Soporte dedicado", included: true },
      { text: "Analytics avanzado", included: true },
      { text: "API access + custom branding", included: true },
    ],
  },
]

function PlanCard({
  plan,
  index,
}: {
  plan: (typeof plans)[0]
  index: number
}) {
  const { ref, isVisible } = useReveal({ threshold: 0.2, delay: index * 120 })

  return (
    <div
      ref={ref}
      className={`relative flex flex-col p-6 md:p-8 rounded-2xl border transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        plan.featured
          ? "bg-white/80 border-ocean/20 shadow-lg shadow-ocean/5 md:-translate-y-2"
          : "bg-white/50 border-charcoal/5"
      } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-4 py-1 text-xs font-medium text-white bg-ocean rounded-full">
            {plan.badge}
          </span>
        </div>
      )}

      {plan.featured && (
        <div className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none">
          <div className="absolute inset-0 rounded-2xl prismatic-border opacity-20" />
        </div>
      )}

      <div className="relative">
        <h3 className="font-display text-lg font-medium text-charcoal-heading mb-2">
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1 mb-6">
          <span className="font-display text-4xl font-semibold text-charcoal-heading">
            {plan.price}
          </span>
          <span className="text-sm text-charcoal/50">{plan.period}</span>
        </div>

        <div className="flex flex-col gap-3 mb-8">
          {plan.features.map((feature) => (
            <div key={feature.text} className="flex items-center gap-2.5">
              {feature.included ? (
                <svg className="w-4 h-4 text-ocean flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-charcoal/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              )}
              <span
                className={`text-sm ${
                  feature.included ? "text-charcoal/70" : "text-charcoal/30"
                }`}
              >
                {feature.text}
              </span>
            </div>
          ))}
        </div>

        <a
          href="https://app.struere.dev"
          className={`block w-full text-center text-sm font-medium py-3 rounded-xl transition-all duration-200 ${
            plan.featured
              ? "bg-ocean text-white hover:bg-ocean-light"
              : "bg-charcoal/5 text-charcoal hover:bg-charcoal/10"
          }`}
        >
          Empezar gratis
        </a>
      </div>
    </div>
  )
}

export function Pricing() {
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section id="precios" className="bg-stone-deep py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div
          ref={ref}
          className={`text-center mb-16 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            Precios simples, sin sorpresas
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map((plan, index) => (
            <PlanCard key={plan.name} plan={plan} index={index} />
          ))}
        </div>

        <div
          className={`text-center mt-10 transition-all duration-700 delay-500 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <a
            href="mailto:hello@struere.dev"
            className="text-sm text-ocean hover:text-ocean-light transition-colors"
          >
            &iquest;Necesitas un plan empresarial? Conversemos &rarr;
          </a>
          <p className="mt-3 text-xs text-charcoal/40">
            Todos los planes incluyen 14 dias de prueba gratis del plan Pro.
          </p>
        </div>
      </div>
    </section>
  )
}
