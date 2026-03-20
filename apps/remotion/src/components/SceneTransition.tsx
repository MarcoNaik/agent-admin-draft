import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface SceneTransitionProps {
  children: React.ReactNode;
  fadeInDuration?: number;
  fadeOutStart?: number;
  fadeOutDuration?: number;
  durationInFrames: number;
}

export const SceneTransition: React.FC<SceneTransitionProps> = ({
  children,
  fadeInDuration = 15,
  fadeOutStart,
  fadeOutDuration = 15,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const fadeInOpacity = fadeInDuration > 0
    ? interpolate(frame, [0, fadeInDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  let fadeOutOpacity = 1;
  if (fadeOutStart !== undefined && fadeOutDuration > 0) {
    fadeOutOpacity = interpolate(
      frame,
      [fadeOutStart, fadeOutStart + fadeOutDuration],
      [1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
  }

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        opacity,
      }}
    >
      {children}
    </div>
  );
};
