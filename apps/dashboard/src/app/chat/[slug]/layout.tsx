import { EnsureUserProvider } from "@/providers/ensure-user"
import { RoleProvider } from "@/contexts/role-context"

export const dynamic = "force-dynamic"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EnsureUserProvider>
      <RoleProvider>
        {children}
      </RoleProvider>
    </EnsureUserProvider>
  )
}
