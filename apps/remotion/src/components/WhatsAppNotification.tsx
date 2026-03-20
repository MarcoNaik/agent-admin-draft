import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fadeIn } from "../lib/animations";

interface WhatsAppNotificationProps {
  message: string;
  sender: string;
  dimBackground?: boolean;
}

export const WhatsAppNotification: React.FC<WhatsAppNotificationProps> = ({
  message,
  sender,
  dimBackground = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneSlide = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 120, mass: 0.6 },
  });

  const notificationSlide = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 60, stiffness: 180, mass: 0.4 },
  });

  const notificationOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const messageAppearFrame = 30;

  const shakeOffset = (() => {
    const shakeFrame = frame - messageAppearFrame;
    if (shakeFrame < 0 || shakeFrame > 6) return 0;
    return interpolate(
      shakeFrame,
      [0, 1.5, 3, 4.5, 6],
      [0, -2, 2, -2, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  })();

  const readReceiptOpacity = fadeIn(frame, messageAppearFrame + 40);

  const watermarkOpacity = fadeIn(frame, messageAppearFrame + 60);

  const dimOpacity = dimBackground
    ? interpolate(frame, [0, 20], [0, 0.7], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8F6F2",
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
      {dimBackground && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(0,0,0,${dimOpacity})`,
            zIndex: 1,
          }}
        />
      )}
      <div
        style={{
          width: "380px",
          height: "780px",
          borderRadius: "48px",
          backgroundColor: "#1A1815",
          boxShadow: "0 40px 80px rgba(0,0,0,0.3)",
          position: "relative",
          zIndex: 2,
          overflow: "hidden",
          border: "4px solid #2D2A26",
          transform: `translateY(${(1 - phoneSlide) * 100}px) translateX(${shakeOffset}px)`,
          opacity: phoneSlide,
        }}
      >
        <div
          style={{
            width: "140px",
            height: "32px",
            backgroundColor: "#1A1815",
            borderRadius: "0 0 20px 20px",
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #075E54 0%, #128C7E 100%)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, padding: "80px 16px 16px" }}>
            <div
              style={{
                opacity: notificationOpacity,
                transform: `translateY(${(1 - notificationSlide) * 30}px)`,
              }}
            >
              <div
                style={{
                  backgroundColor: "#DCF8C6",
                  borderRadius: "12px 12px 12px 4px",
                  padding: "12px 16px",
                  maxWidth: "90%",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#075E54",
                    marginBottom: "4px",
                  }}
                >
                  {sender}
                </div>
                <div
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "15px",
                    color: "#1A1815",
                    lineHeight: 1.4,
                  }}
                >
                  {message}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "4px",
                    marginTop: "4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "11px",
                      color: "rgba(0,0,0,0.4)",
                    }}
                  >
                    now
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#53BDEB",
                      opacity: readReceiptOpacity,
                      letterSpacing: "-3px",
                      marginLeft: "2px",
                    }}
                  >
                    {"✓✓"}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.3)",
                  marginTop: "8px",
                  opacity: watermarkOpacity,
                }}
              >
                Powered by Struere
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
