import Script from "next/script"
import { Providers } from "@/components/providers"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      {children}
      <Script
        src="https://app.struere.dev/embed/widget.js?org=struere-support-1771842295&agent=struere-customer-service&theme=dark&accent=%231B4F72"
        strategy="afterInteractive"
      />
    </Providers>
  )
}
