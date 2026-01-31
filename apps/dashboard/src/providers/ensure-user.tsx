"use client"

import { useEffect, useState, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser, useOrganization } from "@clerk/nextjs"
import { useCurrentUser, useEnsureUser } from "@/hooks/use-convex-data"
import { Loader2 } from "lucide-react"

export function EnsureUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isSignedIn, isLoaded: clerkLoaded } = useUser()
  const { organization: clerkOrg, isLoaded: orgLoaded } = useOrganization()
  const currentUser = useCurrentUser()
  const ensureUser = useEnsureUser()
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) return
    if (currentUser !== undefined) return
    if (isProvisioning) return

    const provision = async () => {
      setIsProvisioning(true)
      try {
        await ensureUser({})
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to provision user")
      } finally {
        setIsProvisioning(false)
      }
    }

    provision()
  }, [clerkLoaded, isSignedIn, currentUser, ensureUser, isProvisioning])

  useEffect(() => {
    if (!clerkLoaded || !orgLoaded || !isSignedIn) return
    if (pathname === "/create-organization") return

    if (!clerkOrg) {
      router.push("/create-organization")
    }
  }, [clerkLoaded, orgLoaded, isSignedIn, clerkOrg, pathname, router])

  if (!clerkLoaded || !orgLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isSignedIn) {
    return <>{children}</>
  }

  if (pathname === "/create-organization") {
    return <>{children}</>
  }

  if (!clerkOrg) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (currentUser === null && !isProvisioning) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Setting up your account...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (currentUser === undefined || currentUser === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
