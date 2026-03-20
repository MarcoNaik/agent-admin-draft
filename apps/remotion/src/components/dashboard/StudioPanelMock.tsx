import React from "react";
import { spring, interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { StudioProgressBar } from "./StudioProgressBar";
import { useSectionFrame } from "../../lib/SectionContext";

interface StudioPanelMockProps {
  children?: React.ReactNode;
  showSendButton?: boolean;
  inputText?: string;
  progressActive?: boolean;
  enterFrame?: number;
  skipEntrance?: boolean;
}

export const StudioPanelMock: React.FC<StudioPanelMockProps> = ({
  children,
  showSendButton = false,
  inputText,
  progressActive = false,
  enterFrame = 0,
  skipEntrance = false,
}) => {
  const frame = useSectionFrame();
  const activeGlow = Math.abs(Math.sin((frame / 25) * Math.PI)) * 0.6 + 0.4;

  const panelLocalFrame = Math.max(0, frame - enterFrame);
  const panelSpring = skipEntrance ? 1 : spring({
    frame: panelLocalFrame,
    fps: 30,
    config: { damping: 14, stiffness: 180, mass: 0.5 },
  });
  const panelSlideX = (1 - panelSpring) * 480;
  const panelOpacity = skipEntrance ? 1 : interpolate(panelLocalFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hasInput = !!inputText;
  const inputBorderColor = hasInput ? DASHBOARD.oceanLight : DASHBOARD.border;
  const inputGlow = hasInput
    ? `0 0 0 2px rgba(44, 125, 160, ${0.15 + 0.1 * Math.sin((frame / 20) * Math.PI * 2)})`
    : "none";
  return (
    <div
      style={{
        width: 480,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONTS.sans,
        transform: `translateX(${panelSlideX}px)`,
        opacity: panelOpacity,
      }}
    >
      <StudioProgressBar active={progressActive} />
      <div
        style={{
          height: 44,
          flexShrink: 0,
          backgroundColor: DASHBOARD.backgroundSecondary,
          borderBottom: `1px solid ${DASHBOARD.border}`,
          padding: "0 12px",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: DASHBOARD.success,
              boxShadow: `0 0 ${activeGlow * 8}px rgba(34,163,82,${activeGlow * 0.5})`,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontFamily: FONTS.sans,
              color: DASHBOARD.contentSecondary,
            }}
          >
            Active
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          {["xAI", "grok-4-1-fast", "Platform"].map((label) => (
            <span
              key={label}
              style={{
                backgroundColor: DASHBOARD.backgroundTertiary,
                border: `1px solid ${DASHBOARD.border}`,
                borderRadius: 9999,
                padding: "2px 8px",
                fontSize: 11,
                fontFamily: FONTS.sans,
                color: DASHBOARD.contentSecondary,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: DASHBOARD.backgroundPrimary,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>

      <div
        style={{
          minHeight: 56,
          flexShrink: 0,
          backgroundColor: DASHBOARD.backgroundSecondary,
          borderTop: `1px solid ${DASHBOARD.border}`,
          padding: "8px 12px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 40,
            backgroundColor: DASHBOARD.backgroundTertiary,
            border: `1px solid ${inputBorderColor}`,
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            boxShadow: inputGlow,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontFamily: FONTS.sans,
              color: inputText
                ? DASHBOARD.contentPrimary
                : DASHBOARD.contentTertiary,
              flex: 1,
              lineHeight: 1.4,
              wordBreak: "break-word" as const,
            }}
          >
            {inputText || "Describe what you want to build..."}
          </span>

          {showSendButton && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: DASHBOARD.ocean,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transform: `scale(${spring({ frame: Math.max(0, frame), fps: 30, config: { damping: 8, stiffness: 400, mass: 0.2 } })})`,
                boxShadow: `0 0 12px rgba(27, 79, 114, 0.4)`,
              }}
            >
              <span
                style={{
                  color: "#ffffff",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
