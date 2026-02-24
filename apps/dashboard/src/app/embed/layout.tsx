export const dynamic = "force-dynamic"

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        body::after {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px;
        }
      `}</style>
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
