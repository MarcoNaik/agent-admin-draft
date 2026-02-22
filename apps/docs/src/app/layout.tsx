import type { Metadata } from "next"
import { DM_Sans, JetBrains_Mono, Fraunces, IBM_Plex_Mono } from "next/font/google"
import { getNavigation } from "@/lib/navigation"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-input",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.struere.dev"),
  title: {
    default: "Struere Docs",
    template: "%s | Struere Docs",
  },
  description: "Documentation for the Struere permission-aware AI agent platform.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Struere Docs",
    description: "Documentation for the Struere permission-aware AI agent platform.",
    url: "https://docs.struere.dev",
    siteName: "Struere Docs",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Struere Docs",
    description: "Documentation for the Struere permission-aware AI agent platform.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navigation = getNavigation()

  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${ibmPlexMono.variable} font-sans`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ocean focus:text-white focus:rounded">
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <Sidebar navigation={navigation} />
          <MobileNav navigation={navigation} />
          <main id="main-content" className="flex-1 pt-[53px] lg:pt-0 lg:pl-64">
            {children}
          </main>
        </div>
        <svg className="hidden" aria-hidden="true">
          <filter id="liquid-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="3"
              seed="1"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      </body>
    </html>
  )
}
