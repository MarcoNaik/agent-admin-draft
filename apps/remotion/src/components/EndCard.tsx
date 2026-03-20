import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { FONTS, LANDING_LIGHT } from "../lib/dashboard-theme";
import { useSectionFrame } from "../lib/SectionContext";

export const EndCard: React.FC = () => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.6 },
  });
  const scale = 0.88 + 0.12 * logoSpring;

  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineSpring = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 14, stiffness: 220, mass: 0.35 },
  });
  const taglineOpacity = taglineSpring;
  const taglineSlide = (1 - taglineSpring) * 30;

  const dividerSpring = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 16, stiffness: 200, mass: 0.3 },
  });

  const subtitleSpring = spring({
    frame: Math.max(0, frame - 24),
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.35 },
  });
  const subtitleOpacity = subtitleSpring;
  const subtitleSlide = (1 - subtitleSpring) * 25;

  const gradientPosition = interpolate(frame, [15, 100], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaSpring = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
  });
  const ctaOpacity = ctaSpring;
  const ctaSlide = (1 - ctaSpring) * 30;
  const ctaPulse = frame > 55 ? 1 + 0.03 * Math.sin((frame - 55) * 0.12) : 1;
  const ctaGlow = frame > 55
    ? 0.15 + 0.1 * Math.sin((frame - 55) * 0.1)
    : 0;

  const urlSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.35 },
  });
  const urlOpacity = urlSpring;
  const urlSlide = (1 - urlSpring) * 15;

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
          background:
            "radial-gradient(ellipse 120% 80% at 50% 20%, rgba(27, 79, 114, 0.06) 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 100% 60% at 50% 80%, rgba(212, 168, 83, 0.04) 0%, transparent 60%)",
        }}
      />
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
          transform: `scale(${scale})`,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 120,
            fontWeight: 600,
            background:
              "linear-gradient(-90deg, #98a8b0, #7898b0, #5880a8, #5880a8, #4878a8, #4870a0, #5078a0, #6890a8, #90a8b8, #b8c0c8 56%, #d8d0c0 58%, #f0e8d8 59%, #e8e8e0 60%, #a0c0e0 62%, #80a8d0, #6888a8, #8898a8)",
            backgroundSize: "300% 100%",
            backgroundPosition: `${gradientPosition}% 0%`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            lineHeight: 1.1,
            filter:
              "drop-shadow(0 0 2px rgba(255,255,255,0.85)) drop-shadow(0 2px 24px rgba(0,0,0,0.15))",
          }}
        >
          Struere
        </div>

        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            textTransform: "uppercase" as const,
            letterSpacing: "0.25em",
            opacity: taglineOpacity,
            transform: `translateY(${taglineSlide}px)`,
            background:
              "linear-gradient(-90deg, #4870a0, #5888b0, #6898c0, #80a8d0, #6898c0, #5888b0, #4870a0)",
            backgroundSize: "200% 100%",
            backgroundPosition: `${gradientPosition}% 0%`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter:
              "drop-shadow(0 0 3px rgba(255,255,255,1)) drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 1px 8px rgba(0,0,0,0.15))",
          }}
        >
          BUILD AI FOR YOUR BUSINESS
        </div>

        <div
          style={{
            width: 400,
            height: 4,
            borderRadius: 2,
            marginTop: 8,
            background: `linear-gradient(90deg, #D4A853 ${gradientPosition % 200}%, #1B4F72 ${(gradientPosition + 50) % 200}%, #2C7DA0 ${(gradientPosition + 100) % 200}%, #E8C468 ${(gradientPosition + 150) % 200}%, #D4A853 ${(gradientPosition + 200) % 200}%)`,
            backgroundSize: "200% 100%",
            transform: `scaleX(${dividerSpring})`,
            opacity: dividerSpring,
          }}
        />

        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 28,
            color: "#2D2A26",
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleSlide}px)`,
            maxWidth: 600,
            lineHeight: 1.4,
          }}
        >
          Build, deploy, and manage AI agents at scale.
        </p>

        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 22,
            fontWeight: 600,
            color: "#ffffff",
            opacity: ctaOpacity,
            transform: `translateY(${ctaSlide}px) scale(${ctaPulse})`,
            marginTop: 16,
            padding: "14px 40px",
            background: "linear-gradient(135deg, #1B4F72, #2C7DA0)",
            borderRadius: 10,
            boxShadow: `0 4px 20px rgba(27, 79, 114, ${0.3 + ctaGlow}), 0 0 ${ctaGlow * 40}px rgba(44, 125, 160, ${ctaGlow})`,
          }}
        >
          Start building for free
        </div>

        <div
          style={{
            opacity: urlOpacity,
            transform: `translateY(${urlSlide}px)`,
            fontFamily: FONTS.input,
            fontSize: 18,
            color: "#1B4F72",
            marginTop: 16,
          }}
        >
          struere.dev
        </div>
      </div>
    </div>
  );
};
