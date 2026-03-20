import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { feedIn } from "../../lib/animations";

interface PipelineStep {
  tool: string;
  status: "success" | "pending";
  durationMs?: number;
}

interface AutomationMockProps {
  trigger: {
    name: string;
    entityType: string;
    action: string;
    enabled: boolean;
    messageTemplate?: string;
  };
  pipelineSteps: PipelineStep[];
  showAt: number;
  expandAt: number;
  executionAt?: number;
  executionData?: Record<string, unknown>;
}

const renderTemplateText = (text: string) => {
  const parts = text.split(/({{.*?}})/g);
  return parts.map((part, i) => {
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return (
        <span key={i} style={{ color: DASHBOARD.amber }}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export const AutomationMock: React.FC<AutomationMockProps> = ({
  trigger,
  pipelineSteps,
  showAt,
  expandAt,
  executionAt,
  executionData,
}) => {
  const frame = useCurrentFrame();

  const triggerAnim = feedIn(frame, showAt);
  const isExpanded = frame >= expandAt;
  const expandProgress = interpolate(
    frame,
    [expandAt, expandAt + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const showExecution =
    executionAt !== undefined && frame >= executionAt;
  const executionAnim = executionAt
    ? feedIn(frame, executionAt)
    : { opacity: 0, translateY: 20 };

  const chevronRotation = interpolate(
    frame,
    [expandAt, expandAt + 10],
    [0, 90],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const totalDuration = pipelineSteps.reduce(
    (sum, s) => sum + (s.durationMs ?? 0),
    0
  );

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
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 20,
          fontWeight: 600,
          color: DASHBOARD.contentPrimary,
        }}
      >
        Automations
      </div>
      <div
        style={{
          fontSize: 14,
          color: DASHBOARD.contentTertiary,
          marginTop: 4,
        }}
      >
        Automated actions on data changes
      </div>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            opacity: triggerAnim.opacity,
            transform: `translateY(${triggerAnim.translateY}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: DASHBOARD.backgroundSecondary,
              border: `1px solid ${DASHBOARD.border}`,
              borderRadius: isExpanded ? "8px 8px 0 0" : 8,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: trigger.enabled
                  ? "#22c55e"
                  : DASHBOARD.contentTertiary,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, marginLeft: 12 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: DASHBOARD.contentPrimary,
                }}
              >
                {trigger.name}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: DASHBOARD.contentSecondary,
                  marginTop: 2,
                }}
              >
                When {trigger.entityType} is {trigger.action} ·{" "}
                {pipelineSteps.length} action
                {pipelineSteps.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div
              style={{
                fontSize: 16,
                color: DASHBOARD.contentTertiary,
                transform: `rotate(${chevronRotation}deg)`,
                flexShrink: 0,
              }}
            >
              ›
            </div>
          </div>

          {isExpanded && (
            <div
              style={{
                backgroundColor: DASHBOARD.backgroundPrimary,
                border: `1px solid ${DASHBOARD.border}`,
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                padding: 16,
                opacity: expandProgress,
                maxHeight: expandProgress * 500,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    backgroundColor: DASHBOARD.backgroundTertiary,
                    border: `1px solid ${DASHBOARD.border}`,
                    borderRadius: 20,
                    padding: "6px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      color: DASHBOARD.contentTertiary,
                      fontSize: 12,
                    }}
                  >
                    ◆
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: DASHBOARD.contentPrimary,
                      fontFamily: FONTS.sans,
                    }}
                  >
                    {trigger.entityType}
                  </span>
                </div>

                <span
                  style={{
                    color: DASHBOARD.contentTertiary,
                    fontSize: 16,
                  }}
                >
                  →
                </span>

                <div
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 20,
                    padding: "6px 14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: DASHBOARD.success,
                      fontFamily: FONTS.sans,
                    }}
                  >
                    {trigger.action}
                  </span>
                </div>

                <span
                  style={{
                    color: DASHBOARD.contentTertiary,
                    fontSize: 16,
                  }}
                >
                  →
                </span>

                <div
                  style={{
                    backgroundColor: DASHBOARD.backgroundTertiary,
                    border: `1px solid ${DASHBOARD.border}`,
                    borderRadius: 20,
                    padding: "6px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      color: DASHBOARD.ocean,
                      fontSize: 12,
                    }}
                  >
                    ▶
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: DASHBOARD.contentPrimary,
                      fontFamily: FONTS.sans,
                    }}
                  >
                    {pipelineSteps.length} action
                    {pipelineSteps.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: DASHBOARD.contentTertiary,
                  textTransform: "uppercase" as const,
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                Pipeline
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {pipelineSteps.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: DASHBOARD.backgroundSecondary,
                      border: `1px solid ${DASHBOARD.border}`,
                      borderRadius: 6,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: DASHBOARD.contentTertiary,
                        width: 20,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontFamily: FONTS.mono,
                          color: DASHBOARD.contentPrimary,
                        }}
                      >
                        {step.tool}
                      </div>
                      {trigger.messageTemplate && i === 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: DASHBOARD.contentSecondary,
                            marginTop: 4,
                            fontFamily: FONTS.sans,
                          }}
                        >
                          {renderTemplateText(trigger.messageTemplate)}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color:
                          step.status === "success"
                            ? "#22c55e"
                            : DASHBOARD.contentTertiary,
                        flexShrink: 0,
                      }}
                    >
                      {step.status === "success" ? "✓" : "○"}
                    </div>
                  </div>
                ))}
              </div>

              {showExecution && (
                <div
                  style={{
                    marginTop: 16,
                    opacity: executionAnim.opacity,
                    transform: `translateY(${executionAnim.translateY}px)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: DASHBOARD.contentTertiary,
                      textTransform: "uppercase" as const,
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    Recent Runs
                  </div>

                  <div
                    style={{
                      backgroundColor: DASHBOARD.backgroundSecondary,
                      border: `1px solid ${DASHBOARD.border}`,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "#22c55e",
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 13,
                          color: DASHBOARD.contentPrimary,
                          fontWeight: 500,
                        }}
                      >
                        Completed
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: DASHBOARD.contentSecondary,
                        }}
                      >
                        {pipelineSteps.length} step
                        {pipelineSteps.length !== 1 ? "s" : ""} ·{" "}
                        {totalDuration}ms
                      </div>
                      <div style={{ flex: 1 }} />
                      <div
                        style={{
                          fontSize: 12,
                          color: DASHBOARD.contentTertiary,
                        }}
                      >
                        just now
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: `1px solid ${DASHBOARD.border}`,
                        padding: 14,
                      }}
                    >
                      {executionData && (
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: DASHBOARD.contentTertiary,
                              marginBottom: 4,
                            }}
                          >
                            Trigger Data
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontFamily: FONTS.mono,
                              color: DASHBOARD.contentSecondary,
                              backgroundColor:
                                DASHBOARD.backgroundTertiary,
                              padding: "8px 10px",
                              borderRadius: 4,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {JSON.stringify(executionData, null, 2)}
                          </div>
                        </div>
                      )}

                      {pipelineSteps.map((step, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 0",
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: "#22c55e",
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              fontSize: 13,
                              fontFamily: FONTS.mono,
                              color: DASHBOARD.contentPrimary,
                              flex: 1,
                            }}
                          >
                            {step.tool}
                          </div>
                          {step.durationMs !== undefined && (
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: FONTS.mono,
                                color: DASHBOARD.contentTertiary,
                              }}
                            >
                              {step.durationMs}ms
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 14,
                              color: "#22c55e",
                              flexShrink: 0,
                            }}
                          >
                            ✓
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
