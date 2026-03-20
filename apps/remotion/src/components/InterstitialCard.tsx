import React from "react";
import { spring, useVideoConfig } from "remotion";
import { FONTS, LANDING_LIGHT } from "../lib/dashboard-theme";
import { fadeIn, slideUp, springScale } from "../lib/animations";
import { useSectionFrame } from "../lib/SectionContext";

interface InterstitialCardProps {
  headline: string;
  subtext: string;
  accentColor?: string;
  variant?: 1 | 2 | 3 | 4;
}

export const InterstitialCard: React.FC<InterstitialCardProps> = ({
  headline,
  subtext,
  accentColor = LANDING_LIGHT.ocean,
  variant,
}) => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const springProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.5 },
  });

  const remaining = 1 - springProgress;
  let contentTransform = "none";
  if (variant === 1) {
    contentTransform = `rotateX(${-15 * remaining}deg) translateZ(${-100 * remaining}px)`;
  } else if (variant === 2) {
    contentTransform = `rotateY(${12 * remaining}deg) translateZ(${-80 * remaining}px)`;
  } else if (variant === 3) {
    contentTransform = `translateZ(${-200 * remaining}px) scale(${0.7 + 0.3 * springProgress})`;
  } else if (variant === 4) {
    contentTransform = `rotateY(${-8 * remaining}deg) rotateX(${5 * remaining}deg) translateZ(${-60 * remaining}px)`;
  }

  const headlineScale = springScale(frame, fps, {
    damping: 14,
    stiffness: 180,
    mass: 0.5,
  });

  const subtextOpacity = fadeIn(frame, 20);
  const subtextSlide = slideUp(frame, 20, 20);

  const accentOpacity = fadeIn(frame, 12, 15);

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
        opacity: 1,
        perspective: 1200,
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
          gap: 0,
          transformStyle: "preserve-3d" as const,
          transform: contentTransform,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 80,
            fontWeight: 700,
            color: "#1A1815",
            transform: `scale(${headlineScale})`,
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: 1200,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            width: 80,
            height: 4,
            borderRadius: 2,
            backgroundColor: accentColor,
            marginTop: 32,
            marginBottom: 32,
            opacity: accentOpacity,
          }}
        />

        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 32,
            fontWeight: 400,
            color: "#574F45",
            opacity: subtextOpacity,
            transform: `translateY(${subtextSlide}px)`,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          {subtext}
        </div>
      </div>
    </div>
  );
};
