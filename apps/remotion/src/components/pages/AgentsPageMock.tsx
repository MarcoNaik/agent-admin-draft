import React from "react";
import { useCurrentFrame } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { feedIn, highlightNew } from "../../lib/animations";
import { ParticleAssembly } from "../effects/ParticleAssembly";

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
  const frame = useCurrentFrame();

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
              : { opacity: 1, translateY: 0 };

          const row = (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                border: `1px solid ${DASHBOARD.border}`,
                borderRadius: 8,
                backgroundColor: `rgba(27, 79, 114, ${0.08 * highlightOpacity})`,
                opacity: feed.opacity,
                transform: `translateY(${feed.translateY}px)`,
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
