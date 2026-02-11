"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#0a1628", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1.5rem" }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #334155",
                backgroundColor: "transparent",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try Again
            </button>
            {error.digest && (
              <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
