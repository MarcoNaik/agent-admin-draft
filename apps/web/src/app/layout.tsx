import type { Metadata } from "next"
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google"
import Script from "next/script"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
})

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  weight: ["400"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://struere.dev"),
  title: "Struere — AI agents for business",
  description:
    "Describe what your business needs. Struere builds AI agents that handle it — no code, no hassle.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Struere — AI agents for business",
    description:
      "Describe what your business needs. Struere builds AI agents that handle it — no code, no hassle.",
    url: "https://struere.dev",
    siteName: "Struere",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Struere — AI agents for business",
    description:
      "Describe what your business needs. Struere builds AI agents that handle it — no code, no hassle.",
    images: ["/opengraph-image"],
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Struere",
      url: "https://struere.dev",
      logo: "https://struere.dev/favicon.svg",
      description:
        "AI agent platform for business automation. Build, deploy, and manage AI agents at scale.",
      email: "hello@struere.dev",
      sameAs: ["https://x.com/struaborrar"],
    },
    {
      "@type": "SoftwareApplication",
      name: "Struere",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Describe what your business needs. Struere builds AI agents that handle customer support, appointments, payments, and more.",
      url: "https://struere.dev",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier with unlimited agents using your own API keys",
      },
      featureList: [
        "Natural language agent creation",
        "WhatsApp Business integration",
        "Google Calendar integration",
        "Multi-agent orchestration",
        "Built-in data layer",
        "Role-based access control",
        "40+ LLM models supported",
        "CLI and SDK for developers",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Struere?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Struere is an AI agent platform for business automation. You describe what your business needs in natural language, and Struere builds AI agents that handle customer support, appointments, payments, and more — complete with a database, integrations, and multi-agent orchestration.",
          },
        },
        {
          "@type": "Question",
          name: "Is Struere free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Struere's platform is free forever when you bring your own API keys. You get unlimited agents, WhatsApp and Calendar integrations, the full developer toolkit, and no platform fees. Alternatively, you can buy credits to skip API key setup, with AI rates plus 10%.",
          },
        },
        {
          "@type": "Question",
          name: "What integrations does Struere support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Struere integrates with WhatsApp Business, Google Calendar, Airtable, email (via Resend), and payment processing (via Flow). It also supports 40+ LLM models including GPT, Claude, Gemini, and Grok through OpenRouter.",
          },
        },
        {
          "@type": "Question",
          name: "How does Struere work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You describe what you need in plain language. Struere's AI builds the agents, database schema, integrations, and automation rules. You can then deploy to WhatsApp, web, or API and monitor conversations in real-time from the dashboard.",
          },
        },
        {
          "@type": "Question",
          name: "What can I build with Struere?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Common use cases include customer support bots with FAQ and order tracking, booking systems with calendar sync, payment collection with reminders, e-commerce product advisors, notification systems, and multi-agent teams that coordinate complex workflows.",
          },
        },
      ],
    },
    {
      "@type": "WebSite",
      name: "Struere",
      url: "https://struere.dev",
      description: "AI agents for business",
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          data-website-id={process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID}
          data-domain="struere.dev"
          src="https://datafa.st/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body
        className={`${dmSans.variable} ${fraunces.variable} ${jetbrains.variable}`}
      >
        {children}
      </body>
    </html>
  )
}
