import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface ChatMessage {
  sender: "user" | "agent";
  text: string;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  messageDelay?: number;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  messageDelay = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8F6F2",
        padding: "60px 100px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
          position: "relative",
          zIndex: 1,
          border: "1px solid rgba(255,255,255,0.3)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)",
          backdropFilter: "blur(12px) saturate(150%)",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(27,79,114,0.1)",
            padding: "18px 28px",
            borderBottom: "1px solid rgba(27,79,114,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "#1B4F72",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#F8F6F2", fontSize: "18px", fontWeight: 700 }}>S</span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "18px",
                fontWeight: 600,
                color: "#1A1815",
              }}
            >
              Dental Receptionist
            </div>
            <div
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: "rgba(45,42,38,0.5)",
              }}
            >
              Online
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "32px 36px",
            minHeight: "480px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            backgroundColor: "rgba(248,246,242,0.4)",
          }}
        >
          {messages.map((message, index) => {
            const messageStartFrame = index * messageDelay;
            if (frame < messageStartFrame) return null;

            const localFrame = frame - messageStartFrame;

            const slideProgress = spring({
              frame: localFrame,
              fps,
              config: { damping: 80, stiffness: 200, mass: 0.4 },
            });

            const opacity = interpolate(localFrame, [0, 10], [0, 1], {
              extrapolateRight: "clamp",
            });

            const isUser = message.sender === "user";

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  opacity,
                  transform: `translateY(${(1 - slideProgress) * 20}px)`,
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "16px 24px",
                    borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                    backgroundColor: isUser ? "#1B4F72" : "#EEEBE5",
                    color: isUser ? "#F8F6F2" : "#2D2A26",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "22px",
                    lineHeight: 1.5,
                    boxShadow: isUser
                      ? "0 4px 12px rgba(27,79,114,0.3)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  {message.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
