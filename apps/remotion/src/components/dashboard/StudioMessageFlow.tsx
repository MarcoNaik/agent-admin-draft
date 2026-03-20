import React from "react";
import { spring, interpolate } from "remotion";
import { feedIn, typewriter, pulsingDot } from "../../lib/animations";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { useSectionFrame } from "../../lib/SectionContext";

export type TimelineItem =
  | { type: "user"; startFrame: number; text: string }
  | { type: "thinking"; startFrame: number; text: string }
  | {
      type: "toolCall";
      startFrame: number;
      icon: "file" | "search" | "terminal" | "edit";
      title: string;
      summary?: string;
      status: "running" | "completed";
      badge?: { text: string; color: "green" | "amber" };
    }
  | {
      type: "fileChange";
      startFrame: number;
      path: string;
      action: "write" | "patch";
      lines: string[];
    }
  | { type: "assistant"; startFrame: number; text: string };

interface StudioMessageFlowProps {
  timeline: TimelineItem[];
}

const TOOL_ICONS: Record<string, string> = {
  file: "📄",
  search: "🔍",
  terminal: "⚡",
  edit: "✏️",
};

const CheckmarkStroke: React.FC<{ frame: number; startFrame: number }> = ({ frame, startFrame }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;
  const progress = Math.min(1, localFrame / 10);
  const pathLength = 24;
  const dashoffset = pathLength * (1 - progress);

  return (
    <svg width={16} height={16} viewBox="0 0 16 16">
      <path
        d="M3 8l3 3 7-7"
        fill="none"
        stroke={DASHBOARD.success}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashoffset}
      />
    </svg>
  );
};

function UserMessage({ item, frame }: { item: Extract<TimelineItem, { type: "user" }>; frame: number }) {
  const anim = feedIn(frame, item.startFrame);

  return (
    <div
      style={{
        opacity: anim.opacity,
        transform: `translateY(${anim.translateY}px)`,
        borderLeft: "2px solid rgba(27, 79, 114, 0.4)",
        padding: "8px 12px",
        marginBottom: 12,
        fontFamily: FONTS.sans,
        fontSize: 14,
        color: DASHBOARD.contentPrimary,
      }}
    >
      {item.text}
    </div>
  );
}

function ThinkingRow({ item, frame }: { item: Extract<TimelineItem, { type: "thinking" }>; frame: number }) {
  const localFrame = Math.max(0, frame - item.startFrame);
  const s = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 14, stiffness: 200, mass: 0.3 },
  });
  const opacity = interpolate(frame, [item.startFrame, item.startFrame + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slideY = (1 - s) * -20;
  const scaleVal = 0.92 + 0.08 * s;
  const textFrame = Math.max(0, frame - item.startFrame - 5);
  const displayText = typewriter(textFrame, item.text, 0.5);
  const thinkingGlow = Math.abs(Math.sin((localFrame / 20) * Math.PI)) * 0.5;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slideY}px) scale(${scaleVal})`,
        transformOrigin: "left top",
        background: "rgba(27, 79, 114, 0.05)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 8,
        boxShadow: `0 0 ${thinkingGlow * 12}px rgba(27, 79, 114, ${thinkingGlow * 0.15})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: displayText ? 6 : 0,
        }}
      >
        <span style={{ fontSize: 14, color: DASHBOARD.oceanLight }}>●</span>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: DASHBOARD.contentTertiary,
            fontStyle: "italic",
          }}
        >
          Thinking...
        </span>
      </div>
      {displayText && (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: DASHBOARD.contentTertiary,
            lineHeight: 1.5,
          }}
        >
          {displayText}
        </div>
      )}
    </div>
  );
}

function ToolCallRow({ item, frame }: { item: Extract<TimelineItem, { type: "toolCall" }>; frame: number }) {
  const localFrame = Math.max(0, frame - item.startFrame);
  const s = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 10, stiffness: 320, mass: 0.25 },
  });
  const opacity = interpolate(frame, [item.startFrame, item.startFrame + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scaleVal = s < 1 ? 0.7 + 0.3 * s : 1;
  const slideX = (1 - s) * -16;
  const dotScale = pulsingDot(frame);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${slideX}px) scale(${scaleVal})`,
        transformOrigin: "left center",
        height: 36,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        background: DASHBOARD.backgroundSecondary,
        border: `1px solid ${DASHBOARD.border}`,
        borderRadius: 6,
        padding: "0 12px",
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 16 }}>{TOOL_ICONS[item.icon]}</span>
      {item.status === "running" ? (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: DASHBOARD.oceanLight,
            display: "inline-block",
            transform: `scale(${dotScale})`,
          }}
        />
      ) : (
        <CheckmarkStroke frame={frame} startFrame={item.startFrame} />
      )}
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: DASHBOARD.contentPrimary,
        }}
      >
        {item.title}
      </span>
      {item.badge && (
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background:
              item.badge.color === "green"
                ? "rgba(34, 163, 82, 0.1)"
                : "rgba(234, 179, 8, 0.1)",
            color: item.badge.color === "green" ? DASHBOARD.success : DASHBOARD.warning,
          }}
        >
          {item.badge.text}
        </span>
      )}
      {item.summary && (
        <span
          style={{
            marginLeft: "auto",
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: DASHBOARD.contentTertiary,
          }}
        >
          {item.summary}
        </span>
      )}
    </div>
  );
}

function FileChangeRow({
  item,
  frame,
}: {
  item: Extract<TimelineItem, { type: "fileChange" }>;
  frame: number;
}) {
  const localFrame = Math.max(0, frame - item.startFrame);
  const s = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 16, stiffness: 180, mass: 0.4 },
  });
  const opacity = interpolate(frame, [item.startFrame, item.startFrame + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scaleY = 0.3 + 0.7 * s;
  const slideY = (1 - s) * 12;
  const linesVisible = Math.floor(Math.max(0, frame - item.startFrame - 10) / 2);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slideY}px) scaleY(${scaleY})`,
        transformOrigin: "left top",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          height: 36,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          background: DASHBOARD.backgroundSecondary,
          border: `1px solid ${DASHBOARD.border}`,
          borderRadius: "6px 6px 0 0",
          padding: "0 12px",
        }}
      >
        <span style={{ fontSize: 16 }}>📄</span>
        <span style={{ fontSize: 14, color: DASHBOARD.success, fontWeight: 700 }}>✓</span>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 13,
            color: DASHBOARD.contentPrimary,
          }}
        >
          {item.path}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: DASHBOARD.contentTertiary,
            textTransform: "uppercase",
          }}
        >
          {item.action}
        </span>
      </div>
      <div
        style={{
          background: DASHBOARD.backgroundChrome,
          padding: 12,
          borderRadius: "0 0 6px 6px",
          maxHeight: 200,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {item.lines.slice(0, linesVisible).map((line, i) => {
          const isAdd = line.startsWith("+");
          const isRemove = line.startsWith("-");
          return (
            <div
              key={i}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                lineHeight: 1.6,
                color: isAdd
                  ? DASHBOARD.success
                  : isRemove
                    ? DASHBOARD.destructive
                    : DASHBOARD.contentTertiary,
                background: isAdd
                  ? "rgba(34, 163, 82, 0.1)"
                  : isRemove
                    ? "rgba(224, 64, 64, 0.1)"
                    : "transparent",
                padding: "0 4px",
              }}
            >
              {line}
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: `linear-gradient(transparent, ${DASHBOARD.backgroundChrome})`,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

function AssistantMessage({
  item,
  frame,
}: {
  item: Extract<TimelineItem, { type: "assistant" }>;
  frame: number;
}) {
  const localFrame = Math.max(0, frame - item.startFrame);
  const s = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 12, stiffness: 260, mass: 0.3 },
  });
  const opacity = interpolate(frame, [item.startFrame, item.startFrame + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slideY = (1 - s) * 18;
  const scaleVal = 0.9 + 0.1 * s;
  const textFrame = Math.max(0, frame - item.startFrame - 5);
  const displayText = typewriter(textFrame, item.text, 0.6);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slideY}px) scale(${scaleVal})`,
        transformOrigin: "left top",
        fontFamily: FONTS.sans,
        fontSize: 14,
        color: DASHBOARD.contentPrimary,
        lineHeight: 1.6,
        marginBottom: 12,
      }}
    >
      {displayText}
    </div>
  );
}

export const StudioMessageFlow: React.FC<StudioMessageFlowProps> = ({ timeline }) => {
  const frame = useSectionFrame();

  const visibleItems = timeline.filter((item) => frame >= item.startFrame);
  const scrollOffset = visibleItems.length > 6 ? (visibleItems.length - 6) * 40 : 0;

  return (
    <div style={{ overflow: "hidden", height: "100%" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          transform: `translateY(-${scrollOffset}px)`,
        }}
      >
        {visibleItems.map((item, i) => {
          switch (item.type) {
            case "user":
              return <UserMessage key={i} item={item} frame={frame} />;
            case "thinking":
              return <ThinkingRow key={i} item={item} frame={frame} />;
            case "toolCall":
              return <ToolCallRow key={i} item={item} frame={frame} />;
            case "fileChange":
              return <FileChangeRow key={i} item={item} frame={frame} />;
            case "assistant":
              return <AssistantMessage key={i} item={item} frame={frame} />;
          }
        })}
      </div>
    </div>
  );
};
