"use client"

import { motion } from "motion/react"
import { useParallaxY, useScaleIn } from "@/hooks/use-scroll-animation"

const testimonials = [
  {
    quote:
      "We used to take 4 hours to reply to each customer. Now our agent responds in 2 minutes, 24/7. WhatsApp sales went up 35%.",
    name: "Maria Gonzalez",
    role: "Founder, Online clothing store",
    flag: "\uD83C\uDDF2\uD83C\uDDFD",
  },
  {
    quote:
      "I set up a scheduling system in 15 minutes. My patients book on their own and I stopped losing appointments.",
    name: "Dr. Carlos Reyes",
    role: "Dentist",
    flag: "\uD83C\uDDE8\uD83C\uDDF1",
  },
  {
    quote:
      "Struere let us automate collections without hiring anyone else. We recovered $12,000 USD in overdue accounts in the first month.",
    name: "Ana Lucia Fernandez",
    role: "CFO, LATAM Distributor",
    flag: "\uD83C\uDDE8\uD83C\uDDF4",
  },
]

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0]
}) {
  const { ref, scale, opacity, y } = useScaleIn()

  return (
    <motion.div
      ref={ref}
      style={{ scale, opacity, y, willChange: "transform, opacity" }}
      className="relative p-6 md:p-8 rounded-2xl bg-white/50 backdrop-blur-sm border border-charcoal/5"
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
    </motion.div>
  )
}

export function Testimonials() {
  const { ref, y } = useParallaxY()

  return (
    <section className="bg-stone-base py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6 md:px-12">
        <div ref={ref} className="text-center mb-16">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-medium text-charcoal-heading"
            style={{ y, willChange: "transform" }}
          >
            What our users say
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.name}
              testimonial={testimonial}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
