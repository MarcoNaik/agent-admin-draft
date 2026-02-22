import type { Metadata } from "next"
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google"
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

export const metadata: Metadata = {
  metadataBase: new URL("https://struere.dev"),
  title: "Struere — Piensa. Escribe. Construye.",
  description:
    "Describe lo que necesita tu negocio y Struere construye agentes inteligentes que trabajan por ti — sin codigo, sin complicaciones.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Struere — Piensa. Escribe. Construye.",
    description:
      "Describe lo que necesita tu negocio y Struere construye agentes inteligentes que trabajan por ti — sin codigo, sin complicaciones.",
    url: "https://struere.dev",
    siteName: "Struere",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Struere — Piensa. Escribe. Construye.",
    description:
      "Describe lo que necesita tu negocio y Struere construye agentes inteligentes que trabajan por ti — sin codigo, sin complicaciones.",
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
        className={`${dmSans.variable} ${fraunces.variable} ${jetbrains.variable}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
