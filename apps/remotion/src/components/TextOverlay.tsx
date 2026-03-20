import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface TextOverlayProps {
  heading?: string;
  body: string;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({ heading, body }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 25], [30, 0], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200, mass: 0.5 },
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8F6F2",
        padding: "120px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          textAlign: "center",
          maxWidth: "1400px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {heading && (
          <h1
            style={{
              fontFamily: "Fraunces, serif",
              fontSize: "72px",
              fontWeight: 600,
              color: "#1A1815",
              marginBottom: "32px",
              lineHeight: 1.1,
            }}
          >
            {heading}
          </h1>
        )}
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: heading ? "36px" : "48px",
            fontWeight: heading ? 400 : 500,
            color: "#2D2A26",
            lineHeight: 1.5,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
};
