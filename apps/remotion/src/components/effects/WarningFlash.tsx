import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface WarningFlashProps {
  triggerFrame: number;
  children?: React.ReactNode;
}

export const WarningFlash: React.FC<WarningFlashProps> = ({ triggerFrame, children }) => {
  const frame = useCurrentFrame();

  const flashOpacity = interpolate(
    frame,
    [triggerFrame, triggerFrame + 5, triggerFrame + 10],
    [0, 0.12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const borderPulse = (() => {
    if (frame < triggerFrame || frame >= triggerFrame + 30) return 0;
    const localFrame = frame - triggerFrame;
    const progress = localFrame / 30;
    const decay = 1 - progress;
    return Math.abs(Math.sin(progress * Math.PI * 2)) * decay;
  })();

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {children}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(239, 68, 68, ${flashOpacity})`,
          borderRadius: 8,
          border: `2px solid rgba(239, 68, 68, ${borderPulse * 0.4})`,
          pointerEvents: "none" as const,
        }}
      />
    </div>
  );
};
