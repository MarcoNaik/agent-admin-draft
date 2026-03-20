import React from "react";
import { interpolate } from "remotion";
import { FONTS, LANDING_LIGHT } from "../lib/dashboard-theme";
import { fadeIn } from "../lib/animations";
import { useSectionFrame, useSectionDuration } from "../lib/SectionContext";

export const ProblemHook: React.FC = () => {
  const frame = useSectionFrame();
  const durationInFrames = useSectionDuration();

  const exitStart = durationInFrames - 12;
  const exitProgress = interpolate(
    frame,
    [exitStart, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const exitOpacity = 1 - exitProgress;
  const exitScale = 1 + exitProgress * 3;
  const exitBlur = exitProgress * 20;

  const line1Opacity = fadeIn(frame, 0, 8);
  const line2Opacity = fadeIn(frame, 24, 8);

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
        opacity: exitOpacity,
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
          transform: `scale(${exitScale})`,
          filter: exitBlur > 0 ? `blur(${exitBlur}px)` : "none",
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
          }}
        >
          What if it took minutes?
        </div>
      </div>
    </div>
  );
};
