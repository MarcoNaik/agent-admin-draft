import { Header } from "@/components/header"
import { EnsureUserProvider } from "@/providers/ensure-user"
import { AgentProvider } from "@/contexts/agent-context"
import { EnvironmentProvider } from "@/contexts/environment-context"
import { RoleProvider } from "@/contexts/role-context"
import { ErrorBoundary } from "@/components/error-boundary"

export const dynamic = "force-dynamic"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary>
      <EnsureUserProvider>
        <RoleProvider>
          <AgentProvider>
            <EnvironmentProvider>
              <div className="flex h-screen flex-col">
                <Header />
                <div className="scrollbar flex-1 overflow-y-auto bg-background-primary">
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </div>
              </div>
            </EnvironmentProvider>
          </AgentProvider>
        </RoleProvider>
      </EnsureUserProvider>
    </ErrorBoundary>
  )
}
