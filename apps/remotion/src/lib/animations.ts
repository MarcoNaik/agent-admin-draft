import { interpolate, spring } from "remotion";

export function typewriter(frame: number, text: string, speed: number = 2): string {
  const charsToShow = Math.floor(frame / speed);
  return text.substring(0, Math.min(charsToShow, text.length));
}

export function fadeIn(frame: number, startFrame: number, duration: number = 15): number {
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function slideUp(frame: number, startFrame: number, duration: number = 20): number {
  return interpolate(frame, [startFrame, startFrame + duration], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function fadeOut(frame: number, startFrame: number, duration: number = 15): number {
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function springScale(
  frame: number,
  fps: number,
  config?: { damping?: number; stiffness?: number; mass?: number },
): number {
  return spring({
    frame,
    fps,
    config: {
      damping: config?.damping ?? 12,
      stiffness: config?.stiffness ?? 200,
      mass: config?.mass ?? 0.5,
    },
  });
}

export function cameraZoom(
  frame: number,
  startFrame: number,
  endFrame: number,
  from: { scale: number; x: number; y: number },
  to: { scale: number; x: number; y: number },
): { scale: number; translateX: number; translateY: number } {
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const t = easeOutSoft(progress);
  return {
    scale: from.scale + (to.scale - from.scale) * t,
    translateX: from.x + (to.x - from.x) * t,
    translateY: from.y + (to.y - from.y) * t,
  };
}

export function staggeredAppear(
  frame: number,
  index: number,
  staggerDelay: number,
  animDuration: number,
): number {
  const itemStart = index * staggerDelay;
  return interpolate(frame, [itemStart, itemStart + animDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function feedIn(
  frame: number,
  startFrame: number,
): { opacity: number; translateY: number } {
  const duration = 10;
  const opacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [startFrame, startFrame + duration], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, translateY };
}

export function highlightNew(frame: number, startFrame: number): number {
  const duration = 45;
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function pulsingDot(frame: number): number {
  const cycle = Math.sin((frame / 30) * Math.PI * 2);
  return interpolate(cycle, [-1, 1], [1.0, 1.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function crossDissolve(
  frame: number,
  startFrame: number,
  duration: number,
): { outOpacity: number; inOpacity: number } {
  const outOpacity = interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inOpacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { outOpacity, inOpacity };
}

export function easeOutSoft(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3.5);
}

export function blinkingCursor(frame: number, fps: number): number {
  const cycleLength = fps;
  const position = frame % cycleLength;
  return position < cycleLength / 2 ? 1 : 0;
}

export function animatedCounter(
  frame: number,
  startFrame: number,
  endFrame: number,
  from: number,
  to: number,
): number {
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const t = easeOutSoft(progress);
  return Math.round(from + (to - from) * t);
}

export function shakeEffect(
  frame: number,
  startFrame: number,
  intensity: number = 3,
  duration: number = 6,
): number {
  if (frame < startFrame || frame >= startFrame + duration) return 0;
  const localFrame = frame - startFrame;
  const progress = localFrame / duration;
  const decay = 1 - progress;
  return Math.sin(localFrame * Math.PI * 2) * intensity * decay;
}

export function glowPulse(
  frame: number,
  startFrame: number,
  pulses: number = 2,
  duration: number = 30,
): number {
  if (frame < startFrame || frame >= startFrame + duration) return 0;
  const localFrame = frame - startFrame;
  const progress = localFrame / duration;
  const decay = 1 - progress;
  return Math.abs(Math.sin(progress * Math.PI * pulses)) * decay;
}
