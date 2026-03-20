import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { FONTS, LANDING_LIGHT } from "../lib/dashboard-theme";
import { fadeIn, slideUp, springScale } from "../lib/animations";

export const ProblemHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const line1Opacity = fadeIn(frame, 0);
  const line1Slide = slideUp(frame, 0);
  const line1Scale = springScale(frame, fps, {
    damping: 14,
    stiffness: 180,
    mass: 0.5,
  });

  const line2Opacity = fadeIn(frame, 20);
  const line2Slide = slideUp(frame, 20);

  const line3Opacity = fadeIn(frame, 40);
  const line3Slide = slideUp(frame, 40);

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
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 42,
            fontWeight: 500,
            color: "#574F45",
            opacity: line1Opacity,
            transform: `translateY(${line1Slide}px) scale(${line1Scale})`,
            textAlign: "center",
          }}
        >
          You hired 3 developers to build a booking bot.
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 42,
            fontWeight: 500,
            color: "#574F45",
            opacity: line2Opacity,
            transform: `translateY(${line2Slide}px)`,
            textAlign: "center",
          }}
        >
          It took 4 months.
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 72,
            fontWeight: 600,
            color: "#1A1815",
            opacity: line3Opacity,
            transform: `translateY(${line3Slide}px)`,
            textAlign: "center",
            maxWidth: 1200,
          }}
        >
          What if it took 4 minutes?
        </div>
      </div>
    </div>
  );
};
