"use client"

import { useReveal } from "@/hooks/use-reveal"

const testimonials = [
  {
    quote:
      "Antes tardabamos 4 horas en responder a cada cliente. Ahora nuestro agente responde en 2 minutos, 24/7. Las ventas por WhatsApp subieron 35%.",
    name: "Maria Gonzalez",
    role: "Fundadora, Tienda online de ropa",
    flag: "\uD83C\uDDF2\uD83C\uDDFD",
  },
  {
    quote:
      "Configure un sistema de agendamiento en 15 minutos. Mis pacientes reservan solos y yo deje de perder citas.",
    name: "Dr. Carlos Reyes",
    role: "Odontologo",
    flag: "\uD83C\uDDE8\uD83C\uDDF1",
  },
  {
    quote:
      "Struere nos permitio automatizar la cobranza sin contratar a nadie mas. Recuperamos $12,000 USD en cuentas vencidas el primer mes.",
    name: "Ana Lucia Fernandez",
    role: "CFO, Distribuidora LATAM",
    flag: "\uD83C\uDDE8\uD83C\uDDF4",
  },
]

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: (typeof testimonials)[0]
  index: number
}) {
  const { ref, isVisible } = useReveal({ threshold: 0.2, delay: index * 150 })

  return (
    <div
      ref={ref}
      className={`relative p-6 md:p-8 rounded-2xl bg-white/50 backdrop-blur-sm border border-charcoal/5 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="absolute top-0 left-0 w-[2px] h-16 rounded-full prismatic-border" />

      <span className="block font-display text-4xl text-charcoal/10 leading-none mb-4">
        &ldquo;
      </span>
      <p className="text-base text-charcoal/70 leading-relaxed mb-6">
        {testimonial.quote}
      </p>
      <div>
        <p className="text-sm font-medium text-charcoal-heading">
          {testimonial.name}
        </p>
        <p className="text-xs text-charcoal/50 mt-1">
          {testimonial.role} {testimonial.flag}
        </p>
      </div>
    </div>
  )
}

export function Testimonials() {
  const { ref, isVisible } = useReveal({ threshold: 0.2 })

  return (
    <section className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div
          ref={ref}
          className={`text-center mb-16 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading">
            Lo que dicen nuestros usuarios
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.name}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
