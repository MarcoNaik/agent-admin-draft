import { Header } from "@/components/header"
import { EnsureUserProvider } from "@/providers/ensure-user"

export const dynamic = "force-dynamic"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EnsureUserProvider>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="scrollbar flex h-screen flex-col overflow-y-auto">
          <div className="h-full grow bg-background-primary p-4">
            <div className="mx-auto transition-all max-w-3xl lg:max-w-5xl xl:max-w-7xl">
              {children}
            </div>
          </div>
        </div>
      </div>
    </EnsureUserProvider>
  )
}
