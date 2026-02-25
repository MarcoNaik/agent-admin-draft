import type { Metadata } from "next"
import { DM_Sans, Fraunces, JetBrains_Mono, IBM_Plex_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
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

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ibm-plex",
  weight: ["400", "500", "700"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://struere.dev"),
  title: "Struere — Piensa. Escribe. Construye.",
  description:
    "Describe lo que necesita tu negocio y Struere construye agentes de IA que trabajan por ti — sin código, sin complicaciones.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Struere — Piensa. Escribe. Construye.",
    description:
      "Describe lo que necesita tu negocio y Struere construye agentes de IA que trabajan por ti — sin código, sin complicaciones.",
    url: "https://struere.dev",
    siteName: "Struere",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Struere — Piensa. Escribe. Construye.",
    description:
      "Describe lo que necesita tu negocio y Struere construye agentes de IA que trabajan por ti — sin código, sin complicaciones.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body
        className={`${dmSans.variable} ${fraunces.variable} ${jetbrains.variable} ${ibmPlexMono.variable}`}
      >
        <Providers>{children}</Providers>
        <script
          src="https://app.struere.dev/embed/widget.js?org=struere-support-1771842295&agent=struere-customer-service&theme=dark&accent=%231B4F72"
          async
          defer
        />
      </body>
    </html>
  )
}
