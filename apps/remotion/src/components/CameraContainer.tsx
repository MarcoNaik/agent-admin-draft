import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

interface CameraPosition {
  scale: number;
  x: number;
  y: number;
}

interface CameraMovement {
  startFrame: number;
  endFrame: number;
  from: CameraPosition;
  to: CameraPosition;
}

interface CameraContainerProps {
  children: React.ReactNode;
  movements: CameraMovement[];
}

const DEFAULT_POSITION: CameraPosition = { scale: 1, x: 960, y: 540 };
const easeOutSoft = Easing.bezier(0.16, 1, 0.3, 1);

export const CameraContainer: React.FC<CameraContainerProps> = ({
  children,
  movements,
}) => {
  const frame = useCurrentFrame();

  let position = DEFAULT_POSITION;

  for (const movement of movements) {
    if (frame < movement.startFrame) {
      break;
    }

    if (frame >= movement.startFrame && frame <= movement.endFrame) {
      const scale = interpolate(
        frame,
        [movement.startFrame, movement.endFrame],
        [movement.from.scale, movement.to.scale],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutSoft },
      );
      const x = interpolate(
        frame,
        [movement.startFrame, movement.endFrame],
        [movement.from.x, movement.to.x],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutSoft },
      );
      const y = interpolate(
        frame,
        [movement.startFrame, movement.endFrame],
        [movement.from.y, movement.to.y],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutSoft },
      );
      position = { scale, x, y };
      break;
    }

    position = movement.to;
  }

  const translateX = 960 - position.x;
  const translateY = 540 - position.y;

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#F2EDE4" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(${translateX}px, ${translateY}px) scale(${position.scale})`,
          transformOrigin: `${position.x}px ${position.y}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
