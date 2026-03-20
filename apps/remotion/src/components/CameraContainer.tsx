import React from "react";
import { spring, useVideoConfig } from "remotion";
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

function springLerp(from: number, to: number, springVal: number): number {
  return from + (to - from) * springVal;
}

export const CameraContainer: React.FC<CameraContainerProps> = ({
  children,
  movements,
}) => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  let position = DEFAULT_POSITION;

  for (const movement of movements) {
    if (frame < movement.startFrame) {
      break;
    }

    if (frame >= movement.startFrame && frame <= movement.endFrame + 15) {
      const localFrame = Math.max(0, frame - movement.startFrame);
      const s = spring({
        frame: localFrame,
        fps,
        config: { damping: 40, stiffness: 120, mass: 0.6 },
        durationInFrames: movement.endFrame - movement.startFrame + 15,
      });
      const scale = springLerp(movement.from.scale, movement.to.scale, s);
      const x = springLerp(movement.from.x, movement.to.x, s);
      const y = springLerp(movement.from.y, movement.to.y, s);
      const rotateX = springLerp(movement.from.rotateX ?? 0, movement.to.rotateX ?? 0, s);
      const rotateY = springLerp(movement.from.rotateY ?? 0, movement.to.rotateY ?? 0, s);
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
