"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type Locale = "es" | "en"

const translations = {
  es: {
    nav: {
      howItWorks: "Cómo funciona",
      useCases: "Casos de uso",
      earlyAccess: "Acceso anticipado",
      docs: "Docs",
      cta: "Comenzar gratis",
    },
    hero: {
      tagline: "PLATAFORMA DE AGENTES DE IA",
      headline: "Piensa. Escribe. Construye.",
      subheadline:
        "Describe lo que necesita tu negocio y Struere construye agentes de IA que trabajan por ti — sin código, sin complicaciones.",
      placeholders: [
        "Un bot de WhatsApp que responda preguntas frecuentes de mis clientes...",
        "Un agente que agende citas y envíe recordatorios automáticos...",
        "Recordatorios de pago por WhatsApp 3 días antes del vencimiento...",
        "Un asistente que gestione reservas para mi restaurante...",
      ],
      suggestions: [
        "Atención al cliente",
        "Agendamiento",
        "Cobranza",
        "Reservas",
      ],
      createButton: "Crear",
      focusPlaceholder: "Describe tu agente...",
      ariaLabel: "Describe tu agente",
      proofLine: "Acceso anticipado gratuito · Sin tarjeta de crédito",
    },
    howItWorks: {
      title: "Así de simple",
      steps: [
        {
          number: "01",
          title: "Describe tu idea",
          description:
            "Escribe en lenguaje natural lo que necesitas. No necesitas escribir código — solo explica qué quieres que haga tu agente, como se lo explicarías a un colega.",
        },
        {
          number: "02",
          title: "Struere lo construye",
          description:
            "Nuestros modelos de IA ensamblan un agente con acceso a los datos de tu negocio, integraciones y flujos de conversación. Crea equipos de agentes que colaboran entre sí. En minutos, no semanas.",
        },
        {
          number: "03",
          title: "Lanza y escala",
          description:
            "Tu agente se despliega al instante en WhatsApp o vía nuestra API. Ve cada conversación en tu inbox, intervén cuando quieras y monitorea uso y costos por agente.",
        },
      ],
    },
    useCases: {
      title: "¿Qué puedes construir?",
      cases: [
        {
          icon: "\uD83D\uDCAC",
          title: "Atención al cliente",
          description:
            "Bot de WhatsApp que responde preguntas y resuelve problemas. Si necesita ayuda, lo ves en tu inbox y tomas el control.",
          prompt: "Un agente que responda dudas sobre envíos y devoluciones",
        },
        {
          icon: "\uD83D\uDCC5",
          title: "Agendamiento automático",
          description:
            "Agentes que agendan citas, envían recordatorios y manejan cancelaciones sin intervención.",
          prompt: "Sistema de reservas para mi consultorio dental",
        },
        {
          icon: "\uD83D\uDCB0",
          title: "Cobranza y seguimiento",
          description:
            "Agentes que envían recordatorios de pago y hacen seguimiento automático a facturas pendientes.",
          prompt:
            "Recordatorios de pago por WhatsApp 3 días antes del vencimiento",
        },
        {
          icon: "\uD83D\uDED2",
          title: "E-commerce",
          description:
            "Asistentes que responden consultas sobre productos, toman pedidos por WhatsApp y ayudan a tus clientes a decidir.",
          prompt:
            "Un agente que ayude a mis clientes a elegir la talla correcta",
        },
        {
          icon: "\uD83D\uDCCB",
          title: "Automatización de tareas",
          description:
            "Cuando un registro cambia de estado, dispara acciones: WhatsApp al cliente, actualización de datos, seguimientos programados con reintentos.",
          prompt: "Enviar un WhatsApp al equipo cuando un pedido cambie a 'listo'",
        },
        {
          icon: "\uD83C\uDF7D\uFE0F",
          title: "Restaurantes",
          description:
            "Agentes que toman pedidos, confirman reservas y responden preguntas sobre tu menú.",
          prompt:
            "Un agente de WhatsApp para mi restaurante que tome pedidos",
        },
      ],
      createAgent: "Crear este agente",
    },
    demo: {
      title: "Míralo en acción",
      promptText:
        "Un agente de WhatsApp para mi restaurante que tome pedidos y confirme reservas",
      buildSteps: [
        "Flujo de conversación",
        "Conexión con WhatsApp",
        "Base de datos de menú",
        "Sistema de reservas",
      ],
      describeLabel: "Describe tu agente:",
      buildingLabel: "Struere configura tu agente...",
      activeLabel: "Agente activo:",
      agentName: "Agente Struere",
      customerMessage: "Quiero reservar una mesa para 4 el viernes",
      agentMessage:
        "\u00a1Perfecto! Te reservé una mesa para 4 este viernes a las 8pm. \u00bfTe envío confirmación por WhatsApp?",
      tryIt: "Comenzar gratis",
    },
    integrations: {
      title: "Integraciones",
      aiModelsLabel: "Modelos de IA",
      available: "Disponible",
      comingSoon: "Próximamente",
      moreComingSoon:
        "Más integraciones en desarrollo.",
    },
    earlyAccess: {
      title: "Gratis durante el acceso anticipado",
      subtitle:
        "Estamos construyendo algo nuevo. Únete temprano y ayúdanos a darle forma.",
      badge: "Acceso anticipado",
      price: "Gratis",
      priceNote: "mientras estamos en desarrollo",
      features: [
        "Agentes ilimitados",
        "WhatsApp Business con inbox en tiempo real",
        "Google Calendar",
        "Base de datos de tu negocio",
        "Equipos multi-agente",
        "Soporte directo del equipo fundador",
      ],
      cta: "Unirme al acceso anticipado",
      note: "Sin tarjeta de crédito \u00b7 Sin compromiso",
    },
    pricing: {
      title: "No te cobramos nada.",
      subtitle: "Trae tus propias API keys y p\u00e1gale directo a tu proveedor. Struere no agrega nada encima.",
      freeBadge: "Trae tus keys",
      freePrice: "$0",
      freePriceNote: "de Struere, para siempre",
      freeFeatures: [
        "Agentes ilimitados",
        "WhatsApp, Calendar, API",
        "CLI local de desarrollo",
        "Equipos multi-agente",
        "Analytics y monitoreo",
        "Sin fees de plataforma",
      ],
      freeHow: "Agrega tus keys de OpenAI, Anthropic o xAI en el panel de Providers. Le pagas directo a tu proveedor \u2014 nosotros no agregamos nada encima.",
      freeCta: "Empezar a construir",
      freeNote: "Sin tarjeta de cr\u00e9dito \u00b7 Sin compromiso",
      managedTitle: "\u00bfNo quieres manejar keys?",
      managedNote: "Usa las nuestras. Pasamos la tarifa del proveedor + 10% solo en tokens de LLM. Es lo \u00fanico que cobramos.",
      tableInput: "Input",
      tableOutput: "Output",
      tableDefault: "Default",
      managedIncludes: "Incluye Studio, nuestro sandbox de agentes con IA.",
      tableFooter: "40+ modelos soportados.",
    },
    cta: {
      title: "\u00bfQué vas a construir?",
      subtitle: "Tu próximo agente está a una conversación de distancia.",
      createButton: "Crear",
      focusPlaceholder: "Describe tu agente...",
      ariaLabel: "Describe tu agente",
    },
    footer: {
      columns: [
        {
          title: "Producto",
          links: [
            { label: "Cómo funciona", href: "#como-funciona" },
            { label: "Casos de uso", href: "#agentes" },
            { label: "Integraciones", href: "#integraciones" },
          ],
        },
        {
          title: "Recursos",
          links: [
            {
              label: "Documentación",
              href: "https://docs.struere.dev",
            },
          ],
        },
        {
          title: "Contacto",
          links: [
            { label: "Email", href: "mailto:hello@struere.dev" },
          ],
        },
        {
          title: "Legal",
          links: [
            {
              label: "Términos de servicio",
              href: "/terms-of-service",
            },
            {
              label: "Política de privacidad",
              href: "/privacy-policy",
            },
          ],
        },
      ],
      madeWith: "Hecho con \uD83E\uDD0D para LATAM",
    },
  },
  en: {
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
        "Customer support",
        "Scheduling",
        "Billing",
        "Reservations",
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
            "Our AI models assemble a working agent with your business data, integrations, and conversation flows. Build agent teams that collaborate. In minutes, not weeks.",
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
    demo: {
      title: "See it in action",
      promptText:
        "A WhatsApp agent for my restaurant that takes orders and confirms reservations",
      buildSteps: [
        "Conversation flow",
        "WhatsApp connection",
        "Menu database",
        "Reservation system",
      ],
      describeLabel: "Describe your agent:",
      buildingLabel: "Struere configures your agent...",
      activeLabel: "Agent active:",
      agentName: "Struere Agent",
      customerMessage: "I'd like to book a table for 4 on Friday",
      agentMessage:
        "Done! I've reserved a table for 4 this Friday at 8pm. Want me to send you a confirmation on WhatsApp?",
      tryIt: "Start free",
    },
    integrations: {
      title: "Integrations",
      aiModelsLabel: "AI models",
      available: "Available",
      comingSoon: "Coming soon",
      moreComingSoon: "More integrations in development.",
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
        "Multi-agent teams",
        "Direct support from the founding team",
      ],
      cta: "Join early access",
      note: "No credit card \u00b7 No commitment",
    },
    pricing: {
      title: "We don\u2019t charge you.",
      subtitle: "Bring your own API keys and pay your providers directly. Struere takes nothing on top.",
      freeBadge: "Bring your keys",
      freePrice: "$0",
      freePriceNote: "Struere fee, forever",
      freeFeatures: [
        "Unlimited agents",
        "WhatsApp, Calendar, API",
        "Local CLI development",
        "Multi-agent teams",
        "Analytics & monitoring",
        "No platform fees",
      ],
      freeHow: "Add your OpenAI, Anthropic, or xAI keys in the Providers panel. You pay your providers directly \u2014 we don\u2019t add anything on top.",
      freeCta: "Start building",
      freeNote: "No credit card \u00b7 No commitment",
      managedTitle: "Don\u2019t want to manage keys?",
      managedNote: "Use ours instead. We pass through provider rates + 10% on LLM tokens only. That\u2019s the only thing we charge for.",
      tableInput: "Input",
      tableOutput: "Output",
      tableDefault: "Default",
      managedIncludes: "Includes Studio, our AI-powered coding sandbox.",
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
            { label: "How it works", href: "#como-funciona" },
            { label: "Use cases", href: "#agentes" },
            { label: "Integrations", href: "#integraciones" },
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
  },
}

type Translations = (typeof translations)["es"]

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: Translations
}

const I18nContext = createContext<I18nContextValue>({
  locale: "es",
  setLocale: () => {},
  t: translations.es,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en")

  useEffect(() => {
    const lang = navigator.language.split("-")[0]
    if (lang === "es") setLocale("es")
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t: translations[locale] }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
