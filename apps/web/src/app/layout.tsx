import type { Metadata } from "next"
import {
  DM_Mono,
  IBM_Plex_Mono,
  Roboto_Mono,
  Source_Code_Pro,
  Overpass_Mono,
  Red_Hat_Mono,
  Fira_Code
} from "next/font/google"
import "./globals.css"

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono"
})

const ibmPlex = IBM_Plex_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex"
})

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono"
})

const sourceCode = Source_Code_Pro({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-source-code"
})

const overpass = Overpass_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-overpass"
})

const redHat = Red_Hat_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-red-hat"
})

const firaCode = Fira_Code({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-fira-code"
})

export const metadata: Metadata = {
  metadataBase: new URL("https://struere.dev"),
  title: "Struere: Agent Factory",
  description: "Build a service business with AI. No coding. Real clients. Real money.",
  openGraph: {
    title: "Struere: Agent Factory",
    description: "Build a service business with AI. No coding. Real clients. Real money.",
    url: "https://struere.dev",
    siteName: "Struere",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Struere: Agent Factory",
    description: "Build a service business with AI. No coding. Real clients. Real money.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${dmMono.variable} ${ibmPlex.variable} ${robotoMono.variable} ${sourceCode.variable} ${overpass.variable} ${redHat.variable} ${firaCode.variable}`}>
        {children}
      </body>
    </html>
  )
}
