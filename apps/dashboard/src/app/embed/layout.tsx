export const dynamic = "force-dynamic"

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  )
}
