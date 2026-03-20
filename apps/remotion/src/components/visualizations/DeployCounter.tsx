import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { feedIn, animatedCounter } from "../../lib/animations";

interface DeployCounterProps {
  startFrame: number;
  staggerDelay?: number;
}

const RESOURCES = [
  { icon: "◆", label: "Agent" },
  { icon: "◇", label: "Data Type" },
  { icon: "▣", label: "Eval Suite" },
  { icon: "⚡", label: "Trigger" },
];

export const DeployCounter: React.FC<DeployCounterProps> = ({
  startFrame,
  staggerDelay = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const summaryFrame = startFrame + staggerDelay * 4 + 10;
  const summaryCount = animatedCounter(frame, summaryFrame, summaryFrame + 15, 0, 4);
  const summaryAnim = feedIn(frame, summaryFrame);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {RESOURCES.map((res, i) => {
          const itemFrame = startFrame + i * staggerDelay;
          const isVisible = frame >= itemFrame;
          if (!isVisible) return <div key={i} style={{ width: 140, height: 40 }} />;

          const checkScale = spring({
            frame: Math.max(0, frame - (itemFrame + 8)),
            fps,
            config: { damping: 12, stiffness: 200, mass: 0.5 },
          });
          const anim = feedIn(frame, itemFrame);

          return (
            <div
              key={i}
              style={{
                opacity: anim.opacity,
                transform: `translateY(${anim.translateY}px)`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: DASHBOARD.backgroundSecondary,
                border: `1px solid ${DASHBOARD.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                minWidth: 140,
              }}
            >
              <span style={{ fontSize: 14, color: DASHBOARD.ocean }}>{res.icon}</span>
              <span style={{ fontFamily: FONTS.sans, fontSize: 13, color: DASHBOARD.contentPrimary, flex: 1 }}>
                {res.label}
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: DASHBOARD.success,
                  transform: `scale(${checkScale})`,
                  display: "inline-block",
                }}
              >
                ✓
              </span>
            </div>
          );
        })}
      </div>
      {frame >= summaryFrame && (
        <div
          style={{
            opacity: summaryAnim.opacity,
            transform: `translateY(${summaryAnim.translateY}px)`,
            fontFamily: FONTS.sans,
            fontSize: 14,
            color: DASHBOARD.contentSecondary,
          }}
        >
          <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: DASHBOARD.success }}>
            {summaryCount}
          </span>{" "}
          resources synced to production
        </div>
      )}
    </div>
  );
};
