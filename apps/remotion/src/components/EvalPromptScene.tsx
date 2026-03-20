import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { FONTS, DASHBOARD } from "../lib/dashboard-theme";
import { blinkingCursor } from "../lib/animations";
import { useSectionFrame } from "../lib/SectionContext";

export const EvalPromptScene: React.FC = () => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const promptText = "Write 20 eval scenarios for edge cases";
  const typeStartFrame = 5;
  const typeSpeed = 1.0;
  const typingDoneFrame = typeStartFrame + Math.ceil(promptText.length / typeSpeed);

  const isTyping = frame >= typeStartFrame && frame < typingDoneFrame;
  const typedChars = isTyping
    ? Math.min(promptText.length, Math.floor((frame - typeStartFrame) / typeSpeed))
    : frame >= typingDoneFrame
      ? promptText.length
      : 0;

  const cursorOpacity = frame >= typeStartFrame ? blinkingCursor(frame, fps) : 0;

  const containerOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingLeft: 200,
        paddingBottom: 40,
        background: DASHBOARD.backgroundPrimary,
        overflow: "hidden",
      }}
    >
      <div style={{ opacity: containerOpacity }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 96,
            fontWeight: 400,
            color: DASHBOARD.contentPrimary,
            whiteSpace: "nowrap",
          }}
        >
          {promptText.substring(0, typedChars)}
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: "1.1em",
              backgroundColor: DASHBOARD.contentPrimary,
              marginLeft: 2,
              verticalAlign: "text-bottom",
              opacity: cursorOpacity,
            }}
          />
        </div>
      </div>
    </div>
  );
};
