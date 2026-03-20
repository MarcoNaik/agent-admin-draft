import React from "react";
import { interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { easeOutSoft } from "../../lib/animations";

interface PassRateMeterProps {
  frame: number;
  fps: number;
  firstSweepStart: number;
  firstSweepEnd: number;
  firstTarget: number;
  failFrame?: number;
  secondSweepStart?: number;
  secondSweepEnd?: number;
  secondTarget?: number;
}

export const PassRateMeter: React.FC<PassRateMeterProps> = ({
  frame,
  firstSweepStart,
  firstSweepEnd,
  firstTarget,
  failFrame,
  secondSweepStart,
  secondSweepEnd,
  secondTarget,
}) => {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let percentage = 0;

  if (frame >= firstSweepStart) {
    const firstProgress = interpolate(
      frame,
      [firstSweepStart, firstSweepEnd],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    percentage = easeOutSoft(firstProgress) * firstTarget;
  }

  if (
    secondSweepStart !== undefined &&
    secondSweepEnd !== undefined &&
    secondTarget !== undefined &&
    frame >= secondSweepStart
  ) {
    const secondProgress = interpolate(
      frame,
      [secondSweepStart, secondSweepEnd],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    percentage =
      firstTarget + easeOutSoft(secondProgress) * (secondTarget - firstTarget);
  }

  const displayPercentage = Math.round(percentage);
  const dashoffset = circumference * (1 - percentage / 100);

  let arcColor = DASHBOARD.ocean;
  if (
    secondSweepEnd !== undefined &&
    frame >= secondSweepEnd &&
    secondTarget !== undefined
  ) {
    arcColor = DASHBOARD.success;
  } else if (failFrame !== undefined && frame >= failFrame) {
    arcColor = DASHBOARD.amber;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E3DCD0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            color: DASHBOARD.contentPrimary,
            lineHeight: 1,
          }}
        >
          {displayPercentage}%
        </span>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: DASHBOARD.contentTertiary,
            marginTop: 2,
          }}
        >
          pass rate
        </span>
      </div>
    </div>
  );
};
