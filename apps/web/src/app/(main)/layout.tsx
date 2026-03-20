import { Providers } from "@/components/providers"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      {children}
      <script
        src="https://app.struere.dev/embed/widget.js?org=struere-support-1771842295&agent=struere-customer-service&theme=dark&accent=%231B4F72"
        async
        defer
      />
    </Providers>
  )
}
