import React from "react";
import { spring, interpolate, useVideoConfig } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { feedIn, highlightNew, glowPulse } from "../../lib/animations";
import { ParticleAssembly } from "../effects/ParticleAssembly";
import { useSectionFrame } from "../../lib/SectionContext";

interface AgentsPageMockProps {
  agents: Array<{ name: string; description: string; status: "active" | "inactive" }>;
  highlightIndex?: number;
  showAt?: number;
}

export const AgentsPageMock: React.FC<AgentsPageMockProps> = ({
  agents,
  highlightIndex,
  showAt,
}) => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "24px",
        backgroundColor: DASHBOARD.backgroundPrimary,
        fontFamily: FONTS.sans,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 20,
            fontWeight: 600,
            color: DASHBOARD.contentPrimary,
          }}
        >
          Agents
        </div>
        <div
          style={{
            fontSize: 14,
            color: DASHBOARD.contentTertiary,
            marginTop: 4,
          }}
        >
          AI agents in your organization
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {agents.map((agent, index) => {
          const isHighlighted = highlightIndex === index;
          const highlightOpacity =
            isHighlighted && showAt !== undefined
              ? highlightNew(frame, showAt)
              : isHighlighted
                ? highlightNew(frame, 0)
                : 0;

          const feed =
            isHighlighted && showAt !== undefined
              ? feedIn(frame, showAt)
              : { opacity: 1, translateY: 0, translateX: 0, scale: 1 };

          const borderGlow =
            isHighlighted && showAt !== undefined
              ? glowPulse(frame, showAt, 3, 60)
              : 0;

          const statusFlashOpacity =
            isHighlighted && showAt !== undefined && agent.status === "active"
              ? interpolate(frame, [showAt, showAt + 10], [0.3, 1.0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;

          const statusDotScale =
            isHighlighted && showAt !== undefined && agent.status === "active"
              ? (() => {
                  const s = spring({
                    frame: Math.max(0, frame - showAt),
                    fps,
                    config: { damping: 6, stiffness: 350, mass: 0.3 },
                  });
                  return 1 + 0.5 * Math.sin(s * Math.PI);
                })()
              : 1;

          const row = (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                border: `1px solid ${borderGlow > 0 ? `rgba(27, 79, 114, ${0.3 + borderGlow * 0.7})` : DASHBOARD.border}`,
                borderRadius: 8,
                backgroundColor: `rgba(27, 79, 114, ${0.08 * highlightOpacity})`,
                opacity: feed.opacity,
                transform: `translateX(${feed.translateX}px) translateY(${feed.translateY}px) scale(${feed.scale})`,
                transformOrigin: "left center",
                boxShadow: borderGlow > 0 ? `0 0 ${borderGlow * 20}px rgba(27, 79, 114, ${borderGlow * 0.25}), 0 0 ${borderGlow * 8}px rgba(44, 125, 160, ${borderGlow * 0.15})` : "none",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  color: DASHBOARD.ocean,
                  flexShrink: 0,
                }}
              >
                ◆
              </div>

              <div style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: DASHBOARD.contentPrimary,
                  }}
                >
                  {agent.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: DASHBOARD.contentSecondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {agent.description}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor:
                      agent.status === "active"
                        ? "#22c55e"
                        : DASHBOARD.contentTertiary,
                    opacity: statusFlashOpacity,
                    transform: `scale(${statusDotScale})`,
                    boxShadow: statusFlashOpacity < 1
                      ? `0 0 ${(1 - statusFlashOpacity) * 12}px rgba(34, 197, 94, ${1 - statusFlashOpacity})`
                      : "none",
                  }}
                />
                <div
                  style={{
                    fontSize: 16,
                    color: DASHBOARD.contentTertiary,
                  }}
                >
                  ›
                </div>
              </div>
            </div>
          );

          if (isHighlighted && showAt !== undefined) {
            return (
              <ParticleAssembly key={index} triggerFrame={showAt}>
                {row}
              </ParticleAssembly>
            );
          }

          return row;
        })}
      </div>
    </div>
  );
};
