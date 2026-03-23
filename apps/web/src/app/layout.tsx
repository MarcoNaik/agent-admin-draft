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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
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
