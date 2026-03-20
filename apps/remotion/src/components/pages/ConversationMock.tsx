import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import {
  fadeOut,
  springScale,
  feedIn,
} from "../../lib/animations";

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
}

interface Message {
  role: "user" | "agent";
  text: string;
  toolCalls?: ToolCall[];
  startFrame: number;
}

interface ConversationMockProps {
  agentName: string;
  threadPreview: string;
  contactName: string;
  messages: Message[];
  showToastAt?: number;
  toastText?: string;
}

const TypingIndicator: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        background: DASHBOARD.backgroundTertiary,
        borderRadius: "20px 20px 20px 4px",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "row",
        gap: 4,
        alignItems: "center",
      }}
    >
      {[0, 1, 2].map((i) => {
        const cycle = Math.sin(((frame + i * 8) / 20) * Math.PI * 2);
        const opacity = interpolate(cycle, [-1, 1], [0.3, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: DASHBOARD.contentTertiary,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

const ToolCallBubble: React.FC<{
  toolCall: ToolCall;
  frame: number;
  startFrame: number;
  fps: number;
}> = ({ toolCall, frame, startFrame, fps }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;
  const scale = springScale(localFrame, fps);
  const glowIntensity = localFrame < 30
    ? Math.abs(Math.sin((localFrame / 15) * Math.PI)) * (1 - localFrame / 30)
    : 0;

  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "60%",
        transform: `scale(${scale})`,
        transformOrigin: "left center",
        boxShadow: glowIntensity > 0 ? `0 0 ${glowIntensity * 16}px rgba(27, 79, 114, ${glowIntensity * 0.3}), 0 0 ${glowIntensity * 4}px rgba(44, 125, 160, ${glowIntensity * 0.2})` : "none",
      }}
    >
      <div
        style={{
          background: DASHBOARD.backgroundSecondary,
          border: `1px solid ${DASHBOARD.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, color: DASHBOARD.oceanLight }}>
            ⚡
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: DASHBOARD.contentPrimary,
            }}
          >
            {toolCall.name}
          </span>
          <span style={{ fontSize: 14, color: DASHBOARD.success }}>✓</span>
        </div>
        <div
          style={{
            background: DASHBOARD.backgroundChrome,
            padding: 8,
            borderRadius: "0 0 6px 6px",
          }}
        >
          {Object.entries(toolCall.args).map(([key, value]) => (
            <div
              key={key}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: DASHBOARD.contentSecondary,
                lineHeight: 1.6,
              }}
            >
              {key}: {JSON.stringify(value)}
            </div>
          ))}
          {toolCall.result &&
            Object.entries(toolCall.result).map(([key, value]) => (
              <div
                key={`result-${key}`}
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: DASHBOARD.contentSecondary,
                  lineHeight: 1.6,
                }}
              >
                → {key}: {JSON.stringify(value)}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export const ConversationMock: React.FC<ConversationMockProps> = ({
  agentName,
  threadPreview,
  contactName,
  messages,
  showToastAt,
  toastText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const firstAgentMessageFrame = messages.find((m) => m.role === "agent")?.startFrame;
  const showUnreadDot =
    firstAgentMessageFrame === undefined || frame < firstAgentMessageFrame;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
        fontFamily: FONTS.sans,
      }}
    >
      <div
        style={{
          width: 280,
          backgroundColor: DASHBOARD.backgroundPrimary,
          borderRight: `1px solid ${DASHBOARD.border}`,
          padding: 12,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 36,
            backgroundColor: DASHBOARD.backgroundTertiary,
            border: `1px solid ${DASHBOARD.border}`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.input,
              fontSize: 12,
              color: DASHBOARD.contentTertiary,
            }}
          >
            Search conversations...
          </span>
        </div>

        <div
          style={{
            backgroundColor: "rgba(27, 79, 114, 0.08)",
            borderRadius: 8,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: DASHBOARD.ocean,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {contactName.charAt(0).toUpperCase()}
          </div>
          <div
            style={{
              flex: 1,
              marginLeft: 10,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: DASHBOARD.contentPrimary,
              }}
            >
              {contactName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: DASHBOARD.contentSecondary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 180,
              }}
            >
              {threadPreview}
            </div>
          </div>
          {showUnreadDot && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: DASHBOARD.ocean,
                flexShrink: 0,
                marginLeft: 8,
              }}
            />
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 56,
            backgroundColor: DASHBOARD.backgroundSecondary,
            borderBottom: `1px solid ${DASHBOARD.border}`,
            padding: "0 20px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: DASHBOARD.ocean,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ◆
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: DASHBOARD.contentPrimary,
              marginLeft: 12,
            }}
          >
            {agentName}
          </span>
          <span
            style={{
              fontSize: 12,
              color: DASHBOARD.success,
              marginLeft: 8,
            }}
          >
            Online
          </span>
        </div>

        <div
          style={{
            flex: 1,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflow: "hidden",
          }}
        >
          {messages.map((message, index) => {
            if (frame < message.startFrame) return null;

            const localFrame = frame - message.startFrame;
            const msgOpacity = interpolate(localFrame, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isUser = message.role === "user";

            const showTyping =
              !isUser && frame >= message.startFrame - 20 && frame < message.startFrame;

            const elements: React.ReactNode[] = [];

            if (showTyping) {
              return null;
            }

            if (!isUser && message.toolCalls) {
              message.toolCalls.forEach((tc, tcIndex) => {
                elements.push(
                  <ToolCallBubble
                    key={`tool-${index}-${tcIndex}`}
                    toolCall={tc}
                    frame={frame}
                    startFrame={message.startFrame - 10}
                    fps={fps}
                  />
                );
              });
            }

            const displayedText = message.text;

            elements.push(
              <div
                key={`msg-${index}`}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "60%",
                  opacity: msgOpacity,
                }}
              >
                <div
                  style={{
                    backgroundColor: isUser
                      ? DASHBOARD.ocean
                      : DASHBOARD.backgroundTertiary,
                    color: isUser ? "#ffffff" : DASHBOARD.contentPrimary,
                    borderRadius: isUser
                      ? "20px 20px 4px 20px"
                      : "20px 20px 20px 4px",
                    padding: "10px 16px",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {displayedText}
                </div>
              </div>
            );

            return <React.Fragment key={index}>{elements}</React.Fragment>;
          })}

          {messages.map((message, index) => {
            if (message.role !== "agent") return null;
            const showTyping =
              frame >= message.startFrame - 20 && frame < message.startFrame;
            if (!showTyping) return null;
            return <TypingIndicator key={`typing-${index}`} frame={frame} />;
          })}
        </div>

        {showToastAt !== undefined && toastText && (
          (() => {
            const toastAnim = feedIn(frame, showToastAt);
            const toastFadeOut = fadeOut(frame, showToastAt + 90);
            const visible = frame >= showToastAt;
            const opacity =
              frame >= showToastAt + 90
                ? toastFadeOut
                : toastAnim.opacity;

            if (!visible) return null;

            return (
              <div
                style={{
                  position: "absolute",
                  top: 12 + 56,
                  right: 12,
                  backgroundColor: DASHBOARD.backgroundSecondary,
                  border: `1px solid rgba(34, 197, 94, 0.2)`,
                  borderRadius: 8,
                  padding: "10px 16px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  opacity,
                  transform: `translateY(${toastAnim.translateY}px)`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: DASHBOARD.success,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: DASHBOARD.contentPrimary,
                  }}
                >
                  {toastText}
                </span>
              </div>
            );
          })()
        )}

      </div>
    </div>
  );
};
