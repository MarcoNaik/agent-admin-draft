export const dynamic = "force-dynamic"

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        html {
          color-scheme: normal !important;
        }
        html, body {
          background: transparent !important;
          background-color: transparent !important;
          height: 100%;
          width: 100%;
          margin: 0;
          overflow: clip;
          position: relative;
          contain: paint;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        body > *, body > * > *, body > * > * > *, body > * > * > * > * {
          background: transparent !important;
        }
        body::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 256px;
        }
        .liquid-glass {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .liquid-glass-dark {
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.06) 0%,
              transparent 40%
            ),
            radial-gradient(
              ellipse at center,
              rgba(20, 30, 50, 0.45) 0%,
              rgba(20, 30, 50, 0.3) 50%,
              rgba(20, 30, 50, 0.2) 100%
            ) !important;
        }
      `}</style>
      {children}
    </>
  )
}
