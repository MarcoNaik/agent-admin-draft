import { Header } from "@/components/header"
import { EnsureUserProvider } from "@/providers/ensure-user"
import { AgentProvider } from "@/contexts/agent-context"
import { EnvironmentProvider } from "@/contexts/environment-context"
import { RoleProvider } from "@/contexts/role-context"
import { StudioProvider } from "@/contexts/studio-context"
import { StudioPanel } from "@/components/studio/studio-panel"
import { ErrorBoundary } from "@/components/error-boundary"
import { SyncNotifications } from "@/components/sync-notifications"

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
              <SyncNotifications />
              <StudioProvider>
                <div className="flex h-screen flex-col">
                  <Header />
                  <div className="flex flex-1 overflow-hidden">
                    <main className="scrollbar flex-1 overflow-y-auto bg-background-primary">
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                    </main>
                    <StudioPanel />
                  </div>
                </div>
              </StudioProvider>
            </EnvironmentProvider>
          </AgentProvider>
        </RoleProvider>
      </EnsureUserProvider>
    </ErrorBoundary>
  )
}
