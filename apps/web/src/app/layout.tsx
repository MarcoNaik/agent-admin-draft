import type { Metadata } from "next"
import { DM_Sans, Fraunces, JetBrains_Mono, IBM_Plex_Mono } from "next/font/google"
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
  },
  twitter: {
    card: "summary_large_image",
    title: "Struere — AI agents for business",
    description:
      "Describe what your business needs. Struere builds AI agents that handle it — no code, no hassle.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} ${jetbrains.variable} ${ibmPlexMono.variable}`}
      >
        {children}
      </body>
    </html>
  )
}
