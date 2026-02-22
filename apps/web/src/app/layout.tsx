import type { Metadata } from "next"
import { DM_Sans, Source_Code_Pro } from "next/font/google"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
})

const sourceCode = Source_Code_Pro({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-source-code",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://struere.dev"),
  title: "Struere — You describe it. We build it.",
  description: "Tell us what your agent should do. It ships with WhatsApp, Calendar, Payments, and more. Free to start.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Struere — You describe it. We build it.",
    description: "Tell us what your agent should do. It ships with WhatsApp, Calendar, Payments, and more. Free to start.",
    url: "https://struere.dev",
    siteName: "Struere",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Struere — You describe it. We build it.",
    description: "Tell us what your agent should do. It ships with WhatsApp, Calendar, Payments, and more. Free to start.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${sourceCode.variable}`}>
        {children}
      </body>
    </html>
  )
}
