import React from "react";
import { useVideoConfig, interpolate, spring } from "remotion";
import { FONTS, LANDING_LIGHT } from "../../lib/dashboard-theme";
import { useSectionFrame } from "../../lib/SectionContext";

export const OpeningOverlay: React.FC = () => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const line1Spring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.45 },
  });
  const line1Opacity = line1Spring;
  const line1SlideUp = (1 - line1Spring) * 35;

  const line2Spring = spring({
    frame: Math.max(0, frame - 22),
    fps,
    config: { damping: 12, stiffness: 160, mass: 0.5 },
  });
  const line2Opacity = line2Spring;
  const line2SlideUp = (1 - line2Spring) * 25;
  const line2Scale = 0.92 + 0.08 * line2Spring;

  const exitProgress = interpolate(frame, [140, 185], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = exitProgress < 0.5
    ? 2 * exitProgress * exitProgress
    : 1 - Math.pow(-2 * exitProgress + 2, 2) / 2;
  const exitOpacity = 1 - eased;

  if (exitOpacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 200,
        zIndex: 10,
        opacity: exitOpacity,
        pointerEvents: "none" as const,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 42,
          fontWeight: 500,
          color: "#574F45",
          opacity: line1Opacity,
          textAlign: "center",
          transform: `translateY(${line1SlideUp}px)`,
        }}
      >
        Automating your business takes months.
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 72,
          fontWeight: 600,
          color: "#1A1815",
          opacity: line2Opacity,
          textAlign: "center",
          maxWidth: 1200,
          marginTop: 24,
          transform: `scale(${line2Scale}) translateY(${line2SlideUp}px)`,
        }}
      >
        What if it took minutes?
      </div>
    </div>
  );
};
