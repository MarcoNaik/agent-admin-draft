"use client"

import { UsersPanel } from "@/components/users-panel"
import { useEnvironment } from "@/contexts/environment-context"
import { useUserPermissions } from "@/hooks/use-users"
import { Loader2 } from "@/lib/icons"

export default function TeamPage() {
  const { environment } = useEnvironment()
  const permissions = useUserPermissions(environment)

  if (permissions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <UsersPanel permissions={permissions} />
}
