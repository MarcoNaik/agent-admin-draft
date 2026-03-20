import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { FONTS, LANDING_LIGHT } from "../lib/dashboard-theme";
import { useSectionFrame } from "../lib/SectionContext";

export const Opening: React.FC = () => {
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

  const line2EntranceSlide = (1 - line2Spring) * 25;
  const line2EntranceScale = 0.92 + 0.08 * line2Spring;

  const exitOpacity = frame >= 60 ? 0 : 1;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: LANDING_LIGHT.stoneBase,
        position: "relative",
        overflow: "hidden",
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
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: exitOpacity,
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
            transform: `scale(${line2EntranceScale}) translateY(${line2EntranceSlide}px)`,
          }}
        >
          What if it took minutes?
        </div>
      </div>
    </div>
  );
};
