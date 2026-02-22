"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground font-sans">
        <div className="flex h-screen items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-display font-semibold text-content-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-content-secondary mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-md border border-border bg-transparent text-content-primary cursor-pointer text-sm transition-colors ease-out-soft hover:bg-background-secondary"
            >
              Try Again
            </button>
            {error.digest && (
              <p className="mt-4 text-xs text-content-tertiary font-mono">
                {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
