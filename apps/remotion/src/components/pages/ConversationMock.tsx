import React from "react";
import { useVideoConfig, interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import {
  fadeOut,
  springScale,
  feedIn,
} from "../../lib/animations";
import { useSectionFrame } from "../../lib/SectionContext";

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
  showWhatsAppToastAt?: number;
  whatsAppToastText?: string;
  showCalendarToastAt?: number;
  calendarToastText?: string;
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
        maxWidth: "70%",
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
            padding: "12px 18px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22, color: DASHBOARD.oceanLight }}>
            ⚡
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 20,
              color: DASHBOARD.contentPrimary,
            }}
          >
            {toolCall.name}
          </span>
          <span style={{ fontSize: 22, color: DASHBOARD.success }}>✓</span>
        </div>
        <div
          style={{
            background: DASHBOARD.backgroundChrome,
            padding: 14,
            borderRadius: "0 0 6px 6px",
          }}
        >
          {Object.entries(toolCall.args).map(([key, value]) => (
            <div
              key={key}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 18,
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
  showWhatsAppToastAt,
  whatsAppToastText,
  showCalendarToastAt,
  calendarToastText,
}) => {
  const frame = useSectionFrame();
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
            height: 72,
            backgroundColor: DASHBOARD.backgroundSecondary,
            borderBottom: `1px solid ${DASHBOARD.border}`,
            padding: "0 24px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: DASHBOARD.ocean,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ◆
          </div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: DASHBOARD.contentPrimary,
              marginLeft: 12,
            }}
          >
            {agentName}
          </span>
          <span
            style={{
              fontSize: 18,
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
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 20,
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
                    startFrame={message.startFrame - 25}
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
                  maxWidth: "70%",
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
                    padding: "16px 24px",
                    fontSize: 28,
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

        {showWhatsAppToastAt !== undefined && whatsAppToastText && (
          (() => {
            const waAnim = feedIn(frame, showWhatsAppToastAt);
            const waVisible = frame >= showWhatsAppToastAt;
            const waOpacity = waAnim.opacity;

            if (!waVisible) return null;

            return (
              <div
                style={{
                  position: "absolute",
                  bottom: 16 + 110,
                  right: 16,
                  backgroundColor: "#fff",
                  borderRadius: 14,
                  padding: "20px 26px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  opacity: waOpacity,
                  transform: `translateY(${-waAnim.translateY}px)`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(37, 211, 102, 0.15)",
                  zIndex: 2,
                }}
              >
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="16" fill="#25D366" />
                  <path d="M22.8 9.1C21.3 7.6 19.3 6.7 17.1 6.7C12.6 6.7 8.9 10.4 8.9 14.9C8.9 16.4 9.3 17.8 10 19.1L8.8 23.3L13.1 22.1C14.3 22.7 15.7 23.1 17.1 23.1C21.6 23.1 25.3 19.4 25.3 14.9C25.3 12.7 24.4 10.7 22.8 9.1ZM17.1 21.7C15.8 21.7 14.6 21.3 13.5 20.7L13.2 20.5L10.6 21.2L11.3 18.7L11.1 18.4C10.4 17.2 10.1 16.1 10.1 14.9C10.1 11.1 13.2 8 17.1 8C18.9 8 20.6 8.7 21.9 10C23.2 11.3 23.9 13 23.9 14.9C24 18.8 20.9 21.7 17.1 21.7ZM20.9 16.6C20.7 16.5 19.6 15.9 19.4 15.8C19.2 15.7 19.1 15.7 18.9 15.9C18.8 16.1 18.3 16.6 18.2 16.8C18.1 16.9 17.9 17 17.7 16.9C17.5 16.8 16.8 16.5 15.9 15.7C15.2 15.1 14.7 14.3 14.6 14.1C14.5 13.9 14.6 13.8 14.7 13.7C14.8 13.6 14.9 13.5 15 13.4C15.1 13.3 15.1 13.2 15.2 13.1C15.3 13 15.2 12.8 15.2 12.7C15.2 12.6 14.7 11.5 14.5 11.1C14.4 10.7 14.2 10.8 14.1 10.8H13.7C13.6 10.8 13.3 10.8 13.1 11C12.9 11.2 12.3 11.8 12.3 13C12.3 14.2 13.1 15.3 13.2 15.5C13.3 15.6 14.7 17.8 16.9 18.8C17.4 19 17.8 19.2 18.1 19.3C18.6 19.5 19.1 19.5 19.5 19.4C19.9 19.3 20.8 18.8 21 18.3C21.2 17.8 21.2 17.3 21.1 17.3C21.1 16.7 20.9 16.7 20.9 16.6Z" fill="white" />
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 15, color: DASHBOARD.contentTertiary, fontWeight: 500 }}>
                    Automation
                  </span>
                  <span style={{ fontSize: 24, color: DASHBOARD.contentPrimary, fontWeight: 500 }}>
                    {whatsAppToastText}
                  </span>
                </div>
              </div>
            );
          })()
        )}

        {showCalendarToastAt !== undefined && calendarToastText && (
          (() => {
            const calAnim = feedIn(frame, showCalendarToastAt);
            const calVisible = frame >= showCalendarToastAt;
            const calOpacity = calAnim.opacity;

            if (!calVisible) return null;

            return (
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  backgroundColor: "#fff",
                  borderRadius: 14,
                  padding: "20px 26px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  opacity: calOpacity,
                  transform: `translateY(${-calAnim.translateY}px)`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(66, 133, 244, 0.15)",
                }}
              >
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="7" fill="#fff" />
                  <rect x="1" y="1" width="30" height="30" rx="6" stroke="#E0E0E0" strokeWidth="0.5" />
                  <rect x="6" y="4" width="20" height="4" rx="1" fill="#4285F4" />
                  <rect x="6" y="9" width="20" height="19" rx="1" fill="#fff" stroke="#DADCE0" strokeWidth="0.5" />
                  <rect x="9" y="12" width="4" height="3" rx="0.5" fill="#4285F4" />
                  <rect x="14" y="12" width="4" height="3" rx="0.5" fill="#4285F4" />
                  <rect x="19" y="12" width="4" height="3" rx="0.5" fill="#4285F4" />
                  <rect x="9" y="17" width="4" height="3" rx="0.5" fill="#EA4335" />
                  <rect x="14" y="17" width="4" height="3" rx="0.5" fill="#FBBC04" />
                  <rect x="19" y="17" width="4" height="3" rx="0.5" fill="#34A853" />
                  <rect x="9" y="22" width="4" height="3" rx="0.5" fill="#DADCE0" />
                  <rect x="14" y="22" width="4" height="3" rx="0.5" fill="#DADCE0" />
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 15, color: DASHBOARD.contentTertiary, fontWeight: 500 }}>
                    Automation
                  </span>
                  <span style={{ fontSize: 24, color: DASHBOARD.contentPrimary, fontWeight: 500 }}>
                    {calendarToastText}
                  </span>
                </div>
              </div>
            );
          })()
        )}

      </div>
    </div>
  );
};
