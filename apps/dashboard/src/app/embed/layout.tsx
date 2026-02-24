export const dynamic = "force-dynamic"

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`html, body { background: transparent !important; }`}</style>
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <filter
          id="glass"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="3"
            seed="5"
            result="noise"
          />
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feDisplacementMap
            in="blur"
            in2="noise"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      {children}
    </>
  )
}
