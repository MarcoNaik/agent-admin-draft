import { Suspense } from "react"
import { Header } from "@/components/header"
import { EnsureUserProvider } from "@/providers/ensure-user"
import { AgentProvider } from "@/contexts/agent-context"
import { EnvironmentProvider } from "@/contexts/environment-context"

export const dynamic = "force-dynamic"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EnsureUserProvider>
      <AgentProvider>
        <Suspense fallback={null}>
          <EnvironmentProvider>
            <div className="flex h-screen flex-col">
              <Header />
              <div className="scrollbar flex flex-1 flex-col overflow-y-auto">
                <div className="flex-1 bg-background-primary">
                  {children}
                </div>
              </div>
            </div>
          </EnvironmentProvider>
        </Suspense>
      </AgentProvider>
    </EnsureUserProvider>
  )
}
