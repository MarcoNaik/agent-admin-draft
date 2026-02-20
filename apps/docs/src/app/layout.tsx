import type { Metadata } from "next"
import { DM_Mono, Fira_Code } from "next/font/google"
import { getNavigation } from "@/lib/navigation"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import "./globals.css"

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
})

const firaCode = Fira_Code({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-fira-code",
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
      <body className={`${dmMono.variable} ${firaCode.variable} font-mono`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-forest focus:text-cream focus:rounded">
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <Sidebar navigation={navigation} />
          <MobileNav navigation={navigation} />
          <main id="main-content" className="flex-1 pt-[53px] lg:pt-0 lg:pl-64">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
