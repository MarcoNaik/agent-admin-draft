import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Struere — AI agents for business"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#F8F6F2",
            letterSpacing: "-0.02em",
          }}
        >
          Struere
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#a1a1aa",
            marginTop: 16,
          }}
        >
          AI agents for business
        </div>
      </div>
    ),
    { ...size },
  )
}
