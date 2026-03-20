import React from "react";
import { useVideoConfig, interpolate, spring } from "remotion";
import { FONTS, LANDING_LIGHT } from "../../lib/dashboard-theme";
import { fadeIn, blinkingCursor } from "../../lib/animations";
import { useSectionFrame } from "../../lib/SectionContext";

interface Suggestion {
  label: string;
}

interface LandingHeroMockProps {
  headline: string;
  tagline: string;
  promptText: string;
  suggestions: Suggestion[];
}

export const LandingHeroMock: React.FC<LandingHeroMockProps> = ({
  headline,
  tagline,
}) => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const headlineDelay = 190;
  const headlineSpring = spring({
    frame: Math.max(0, frame - headlineDelay),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.45 },
  });
  const headlineOpacity = headlineSpring;
  const headlineSlideUp = (1 - headlineSpring) * 30;
  const headlineScale = 0.94 + 0.06 * headlineSpring;

  const taglineSpring = spring({
    frame: Math.max(0, frame - headlineDelay - 10),
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.35 },
  });
  const taglineOpacity = taglineSpring;
  const taglineSlide = (1 - taglineSpring) * 20;

  const gradientPosition = interpolate(frame, [headlineDelay, headlineDelay + 90], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const promptAppearFrame = 40;
  const promptOpacity = fadeIn(frame, promptAppearFrame, 8);
  const promptSlide = 0;

  const promptPrefix = "Build a receptionist for my ";
  const promptSuffix = "";
  const businessName = "dental clinic";
  const fullText = promptPrefix + businessName + promptSuffix;
  const CYCLE_ITEMS = ["car detailing shop", "law firm", "real estate agency", "dental clinic"];

  const typeStartFrame = 70;
  const typeSpeed = 1.0;
  const typingDoneFrame = typeStartFrame + Math.ceil(fullText.length / typeSpeed);

  const cyclePause = 12;
  const cycleStartFrame = typingDoneFrame + cyclePause;
  const cycleDuration = 25;
  const totalCycles = CYCLE_ITEMS.length;
  const cycleEndFrame = cycleStartFrame + cycleDuration * totalCycles;

  const isTyping = frame >= typeStartFrame && frame < typingDoneFrame;
  const isCycling = frame >= cycleStartFrame && frame < cycleEndFrame;

  const typedChars = isTyping
    ? Math.min(fullText.length, Math.floor((frame - typeStartFrame) / typeSpeed))
    : fullText.length;

  const cycleIndex = isCycling
    ? Math.floor((frame - cycleStartFrame) / cycleDuration) % totalCycles
    : totalCycles - 1;
  const cycleLocalFrame = isCycling ? (frame - cycleStartFrame) % cycleDuration : 0;

  const currentItem = isCycling ? CYCLE_ITEMS[cycleIndex] : CYCLE_ITEMS[totalCycles - 1];

  const isLastCycle = isCycling && cycleIndex === totalCycles - 1;
  const itemOpacity = isCycling
    ? isLastCycle
      ? interpolate(cycleLocalFrame, [0, 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(cycleLocalFrame, [0, 4, cycleDuration - 4, cycleDuration], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
    : 1;

  const cursorOpacity = (isTyping || isCycling) ? blinkingCursor(frame, fps) : 0;
  const sendOpacity = fadeIn(frame, cycleEndFrame);

  const businessStyle: React.CSSProperties = {
    color: "#D4A853",
    fontWeight: 600,
    fontStyle: "italic" as const,
  };

  const prefixEnd = promptPrefix.length;
  const businessEnd = prefixEnd + businessName.length;

  const renderPromptContent = () => {
    if (frame < typeStartFrame) return null;

    if (isTyping) {
      const typed = fullText.substring(0, typedChars);
      if (typedChars <= prefixEnd) {
        return <>{typed}</>;
      } else if (typedChars <= businessEnd) {
        return (
          <>
            {promptPrefix}
            <span style={businessStyle}>{typed.substring(prefixEnd)}</span>
          </>
        );
      } else {
        return (
          <>
            {promptPrefix}
            <span style={businessStyle}>{businessName}</span>
            {typed.substring(businessEnd)}
          </>
        );
      }
    }

    return (
      <>
        {promptPrefix}
        <span style={{ ...businessStyle, opacity: itemOpacity }}>
          {currentItem}
        </span>
        {promptSuffix}
      </>
    );
  };

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: LANDING_LIGHT.stoneBase,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background:
            "linear-gradient(to top, rgba(241, 237, 231, 0.8) 0%, transparent 100%)",
        }}
      />

      <div
        style={{
          marginTop: 300,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 88,
            fontWeight: 600,
            opacity: headlineOpacity,
            transform: `translateY(${headlineSlideUp}px) scale(${headlineScale})`,
            background:
              "linear-gradient(-90deg, #98a8b0, #7898b0, #5880a8, #5880a8, #4878a8, #4870a0, #5078a0, #6890a8, #90a8b8, #b8c0c8 56%, #d8d0c0 58%, #f0e8d8 59%, #e8e8e0 60%, #a0c0e0 62%, #80a8d0, #6888a8, #8898a8)",
            backgroundSize: "300% 100%",
            backgroundPosition: `${gradientPosition}% 0%`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            lineHeight: 1.2,
            filter:
              "drop-shadow(0 0 2px rgba(255,255,255,0.85)) drop-shadow(0 2px 24px rgba(0,0,0,0.15))",
            paddingBottom: 8,
          }}
        >
          {headline}
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
          {tagline}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 720,
            opacity: promptOpacity,
            transform: `translateY(${promptSlide}px)`,
          }}
        >
          <div
            style={{
              background: "rgba(20, 22, 28, 0.65)",
              borderRadius: 16,
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
              position: "relative",
            }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 17,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.95)",
                  padding: "20px 24px 56px 24px",
                  minHeight: 72,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {renderPromptContent()}
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "1.1em",
                    backgroundColor: "rgba(255,255,255,0.6)",
                    marginLeft: 1,
                    verticalAlign: "text-bottom",
                    opacity: cursorOpacity,
                  }}
                />
              </div>

              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                }}
              >
                <div
                  style={{
                    padding: "10px 24px",
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: FONTS.sans,
                    color: "rgba(255,255,255,0.7)",
                    borderRadius: 12,
                    opacity: sendOpacity,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Try it free
                  <span style={{ fontSize: 16 }}>&rarr;</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
