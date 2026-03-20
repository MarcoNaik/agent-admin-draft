import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { DASHBOARD } from "../../lib/dashboard-theme";

interface ParticleAssemblyProps {
  triggerFrame: number;
  children: React.ReactNode;
}

const PARTICLE_COLORS = [
  DASHBOARD.ocean,
  DASHBOARD.amber,
  DASHBOARD.success,
  DASHBOARD.oceanLight,
  DASHBOARD.destructive,
];

const PARTICLE_COUNT = 10;

function getStartPosition(index: number): { x: number; y: number } {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + 0.3;
  const radius = 160 + (index % 3) * 40;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export const ParticleAssembly: React.FC<ParticleAssemblyProps> = ({
  triggerFrame,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const convergenceFrame = triggerFrame + 20;

  const childScale =
    frame < convergenceFrame
      ? 0.95
      : 0.95 +
        0.05 *
          spring({
            frame: frame - convergenceFrame,
            fps,
            config: { damping: 12, stiffness: 200, mass: 0.5 },
          });

  return (
    <div style={{ position: "relative" }}>
      <div style={{ transform: `scale(${childScale})` }}>{children}</div>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const start = getStartPosition(i);
        const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];

        const springProgress = spring({
          frame: Math.max(0, frame - triggerFrame),
          fps,
          config: { damping: 15, stiffness: 180, mass: 0.5 },
        });

        const progress = frame < triggerFrame ? 0 : springProgress;

        const x = start.x * (1 - progress);
        const y = start.y * (1 - progress);

        const fadeEnd = triggerFrame + 20;
        const fadeStart = fadeEnd - 5;
        const opacity = interpolate(
          frame,
          [triggerFrame, fadeStart, fadeEnd],
          [0.8, 0.8, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

        if (frame < triggerFrame || frame > fadeEnd) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 14,
              height: 10,
              borderRadius: 2,
              backgroundColor: color,
              opacity,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              pointerEvents: "none" as const,
            }}
          />
        );
      })}
    </div>
  );
};
