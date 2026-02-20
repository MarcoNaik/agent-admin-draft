import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <h1 className="text-4xl font-bold text-forest mb-2">404</h1>
      <p className="text-forest-muted mb-6">Page not found</p>
      <Link
        href="/introduction"
        className="px-4 py-2 text-sm bg-forest text-cream rounded hover:bg-forest/90 transition-colors"
      >
        Go to docs
      </Link>
    </div>
  )
}
