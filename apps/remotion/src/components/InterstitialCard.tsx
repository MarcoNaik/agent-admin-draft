import React from "react";
import { spring, useVideoConfig } from "remotion";
import { FONTS, LANDING_LIGHT } from "../lib/dashboard-theme";
import { fadeIn, slideUp } from "../lib/animations";
import { useSectionFrame } from "../lib/SectionContext";

interface InterstitialCardProps {
  headline: string;
  subtext: string;
  accentColor?: string;
}

export const InterstitialCard: React.FC<InterstitialCardProps> = ({
  headline,
  subtext,
  accentColor = LANDING_LIGHT.ocean,
}) => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const words = headline.split(" ");

  const subtextOpacity = fadeIn(frame, 20);
  const subtextSlide = slideUp(frame, 20, 20);

  const lastWordDelay = (words.length - 1) * 5;
  const accentOpacity = fadeIn(frame, lastWordDelay + 10, 8);

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
          gap: 0,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: 1200,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 24px",
          }}
        >
          {words.map((word, i) => {
            const wordDelay = i * 5;
            const wordSpring = spring({
              frame: Math.max(0, frame - wordDelay),
              fps,
              config: { damping: 12, stiffness: 180, mass: 0.45 },
            });
            const wordY = (1 - wordSpring) * 40;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  color: "#1A1815",
                  opacity: wordSpring,
                  transform: `translateY(${wordY}px) scale(${0.8 + 0.2 * wordSpring})`,
                }}
              >
                {word}
              </span>
            );
          })}
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
            transform: `scaleX(${accentOpacity})`,
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
