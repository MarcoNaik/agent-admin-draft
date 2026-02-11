"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Loader2 } from "lucide-react"
import { useCurrentRole } from "@/hooks/use-current-role"

const roleDefaultRoutes: Record<string, string> = {
  admin: "/agents",
  teacher: "/teacher/sessions",
  guardian: "/guardian/sessions",
  member: "/conversations",
}

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth()
  const { role, isLoading } = useCurrentRole()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.replace("/sign-in")
      return
    }
    if (isLoading) return
    router.replace(roleDefaultRoutes[role] || "/conversations")
  }, [isLoaded, isSignedIn, isLoading, role, router])

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
