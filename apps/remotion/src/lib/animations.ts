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
): { opacity: number; translateY: number; translateX: number; scale: number } {
  const localFrame = Math.max(0, frame - startFrame);
  const duration = 10;
  const opacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const springVal = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 11, stiffness: 260, mass: 0.35 },
  });
  const translateX = (1 - springVal) * 120;
  const translateY = (1 - springVal) * 8;
  const scale = 0.85 + 0.15 * springVal;
  return { opacity, translateY, translateX, scale };
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

export function sectionOpacity(
  globalFrame: number,
  enterStart: number,
  enterEnd: number,
  exitStart: number,
  exitEnd: number,
): number {
  const enterOp = enterStart === enterEnd
    ? 1
    : interpolate(globalFrame, [enterStart, enterEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const exitOp = exitStart === exitEnd
    ? 1
    : interpolate(globalFrame, [exitStart, exitEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  return Math.min(enterOp, exitOp);
}

export function scaleTransition(
  globalFrame: number,
  startFrame: number,
  endFrame: number,
  fromScale: number,
  toScale: number,
): number {
  const progress = interpolate(globalFrame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return fromScale + (toScale - fromScale) * easeOutSoft(progress);
}

export function sceneTransform3D(
  globalFrame: number,
  startFrame: number,
  endFrame: number,
  type: "push" | "pull" | "turnLeft" | "turnRight" | "tiltUp" | "crane" | "deepPush",
): string {
  const progress = interpolate(globalFrame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const t = easeOutSoft(progress);
  const r = 1 - t;

  switch (type) {
    case "push":
      return `translateZ(${-300 * r}px) rotateX(${2 * r}deg)`;
    case "turnLeft":
      return `rotateY(${8 * r}deg) translateZ(${-150 * r}px)`;
    case "turnRight":
      return `rotateY(${-8 * r}deg) translateZ(${-150 * r}px)`;
    case "pull":
      return `translateZ(${200 * r}px) scale(${1 + 0.1 * r})`;
    case "tiltUp":
      return `rotateX(${-6 * r}deg) translateZ(${-100 * r}px)`;
    case "crane":
      return `rotateX(${4 * r}deg) rotateY(${-3 * r}deg) translateZ(${-200 * r}px)`;
    case "deepPush":
      return `translateZ(${-400 * r}px)`;
  }
}

export function dipToDark(
  globalFrame: number,
  darkStart: number,
  darkHold: number,
  darkEnd: number,
  holdEnd?: number,
): number {
  const fadeOutStart = holdEnd ?? darkHold;
  if (globalFrame < darkStart) return 0;
  if (globalFrame >= darkEnd) return 0;
  if (globalFrame <= darkHold) {
    return interpolate(globalFrame, [darkStart, darkHold], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  if (globalFrame <= fadeOutStart) return 1;
  return interpolate(globalFrame, [fadeOutStart, darkEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function lateralSlide(
  globalFrame: number,
  transitionStart: number,
  transitionEnd: number,
  direction: "left" | "right",
): number {
  const progress = interpolate(globalFrame, [transitionStart, transitionEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const t = easeOutSoft(progress);
  return direction === "left" ? -t * 100 : (1 - t) * 100;
}

export function scalePunchExit(
  globalFrame: number,
  exitStart: number,
  exitEnd: number,
): { scale: number; opacity: number } {
  const progress = interpolate(globalFrame, [exitStart, exitEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const t = easeOutSoft(progress);
  return {
    scale: 1 + 0.15 * t,
    opacity: 1 - t,
  };
}

export function wipeProgress(
  globalFrame: number,
  wipeStart: number,
  wipeEnd: number,
): number {
  return interpolate(globalFrame, [wipeStart, wipeEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
