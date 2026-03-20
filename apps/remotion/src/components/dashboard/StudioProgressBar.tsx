import React from "react";
import { DASHBOARD } from "../../lib/dashboard-theme";
import { useSectionFrame } from "../../lib/SectionContext";

interface StudioProgressBarProps {
  active: boolean;
}

export const StudioProgressBar: React.FC<StudioProgressBarProps> = ({ active }) => {
  const frame = useSectionFrame();

  if (!active) return <div style={{ height: 2 }} />;

  const cycle = (frame % 90) / 90;
  const eased = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
  const position = eased * 200;

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
