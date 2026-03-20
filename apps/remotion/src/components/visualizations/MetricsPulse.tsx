import React from "react";
import { useCurrentFrame } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { feedIn, fadeOut } from "../../lib/animations";

interface MetricsPulseProps {
  showAt: number;
  hideAt: number;
}

const METRICS = [
  { label: "Response Time", value: "1.2s" },
  { label: "Tools Used", value: "2" },
];

export const MetricsPulse: React.FC<MetricsPulseProps> = ({ showAt, hideAt }) => {
  const frame = useCurrentFrame();

  if (frame < showAt) return null;

  const exitOpacity = frame >= hideAt ? fadeOut(frame, hideAt, 15) : 1;

  return (
    <div
      style={{
        width: 200,
        backgroundColor: DASHBOARD.backgroundSecondary,
        border: `1px solid ${DASHBOARD.border}`,
        borderRadius: 8,
        padding: 12,
        opacity: exitOpacity,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {METRICS.map((metric, i) => {
        const itemFrame = showAt + i * 10;
        const anim = feedIn(frame, itemFrame);
        if (frame < itemFrame) return null;

        return (
          <div
            key={i}
            style={{
              opacity: anim.opacity,
              transform: `translateY(${anim.translateY}px)`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: FONTS.sans, fontSize: 12, color: DASHBOARD.contentTertiary }}>
              {metric.label}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: DASHBOARD.contentPrimary }}>
              {metric.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};
