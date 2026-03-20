import React from "react";
import { interpolate } from "remotion";
import { DASHBOARD } from "../../lib/dashboard-theme";
import { useSectionFrame } from "../../lib/SectionContext";

interface StudioProgressBarProps {
  active: boolean;
}

export const StudioProgressBar: React.FC<StudioProgressBarProps> = ({ active }) => {
  const frame = useSectionFrame();

  if (!active) return <div style={{ height: 2 }} />;

  const position = interpolate(frame, [0, 60], [0, 200], {
    extrapolateRight: "extend",
  });

  return (
    <div
      style={{
        height: 2,
        width: "100%",
        background: `linear-gradient(90deg, ${DASHBOARD.ocean}, ${DASHBOARD.amber}, ${DASHBOARD.oceanLight}, ${DASHBOARD.ocean})`,
        backgroundSize: "200% 100%",
        backgroundPosition: `${position % 200}% 0`,
      }}
    />
  );
};
