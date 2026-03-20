import React from "react";
import { interpolate, Easing } from "remotion";
import { useSectionFrame } from "../lib/SectionContext";

interface CameraPosition {
  scale: number;
  x: number;
  y: number;
  rotateX?: number;
  rotateY?: number;
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

const DEFAULT_POSITION: CameraPosition = { scale: 1, x: 960, y: 540, rotateX: 0, rotateY: 0 };
const easeOutSoft = Easing.bezier(0.16, 1, 0.3, 1);

export const CameraContainer: React.FC<CameraContainerProps> = ({
  children,
  movements,
}) => {
  const frame = useSectionFrame();

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
      const rotateX = interpolate(
        frame,
        [movement.startFrame, movement.endFrame],
        [movement.from.rotateX ?? 0, movement.to.rotateX ?? 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutSoft },
      );
      const rotateY = interpolate(
        frame,
        [movement.startFrame, movement.endFrame],
        [movement.from.rotateY ?? 0, movement.to.rotateY ?? 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOutSoft },
      );
      position = { scale, x, y, rotateX, rotateY };
      break;
    }

    position = movement.to;
  }

  const translateX = 960 - position.x;
  const translateY = 540 - position.y;
  const hasRotation = (position.rotateX ?? 0) !== 0 || (position.rotateY ?? 0) !== 0;

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#F2EDE4", perspective: hasRotation ? 1200 : undefined }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(${translateX}px, ${translateY}px) scale(${position.scale}) rotateX(${position.rotateX ?? 0}deg) rotateY(${position.rotateY ?? 0}deg)`,
          transformOrigin: `${position.x}px ${position.y}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
