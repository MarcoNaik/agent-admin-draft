import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <h1 className="text-4xl font-bold text-charcoal-heading mb-2 font-display">404</h1>
      <p className="text-content-secondary mb-6">Page not found</p>
      <Link
        href="/introduction"
        className="px-4 py-2 text-sm bg-ocean text-white rounded hover:bg-ocean-light transition-colors"
      >
        Go to docs
      </Link>
    </div>
  )
}
