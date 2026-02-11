"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useOrganization } from "@clerk/nextjs"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const PERMISSION_PATTERNS = [
  "Admin access required",
  "Access denied",
  "not authorized",
  "permission denied",
  "Not authenticated",
]

function isPermissionError(message: string) {
  return PERMISSION_PATTERNS.some((p) =>
    message.toLowerCase().includes(p.toLowerCase())
  )
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const { organization } = useOrganization()
  const permissionError = isPermissionError(error.message)

  useEffect(() => {
    console.error("[dashboard error]", error)
  }, [error])

  return (
    <div className="flex h-[80vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>

        {permissionError ? (
          <>
            <h2 className="mb-2 text-lg font-semibold text-content-primary">
              Access Denied
            </h2>
            <p className="mb-6 text-sm text-content-secondary">
              You don&apos;t have permission to view this page
              {organization?.name ? ` in ${organization.name}` : ""}.
              Try switching to a different organization or contact your admin.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={() => router.replace("/")}>
                Home
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-semibold text-content-primary">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-content-secondary">
              An unexpected error occurred. Please try again.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={reset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </>
        )}

        {error.digest && (
          <p className="mt-4 font-mono text-xs text-content-tertiary">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
