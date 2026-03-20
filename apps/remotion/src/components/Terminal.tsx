import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { typewriter } from "../lib/animations";

interface TerminalLine {
  type: "input" | "output";
  text: string;
}

interface TerminalProps {
  lines: TerminalLine[];
  typingSpeed?: number;
  lineDelay?: number;
}

export const Terminal: React.FC<TerminalProps> = ({
  lines,
  typingSpeed = 1.5,
  lineDelay = 20,
}) => {
  const frame = useCurrentFrame();

  const getLineStartFrame = (index: number): number => {
    let totalFrames = 0;
    for (let i = 0; i < index; i++) {
      const line = lines[i];
      if (line.type === "input") {
        totalFrames += line.text.length * typingSpeed + lineDelay;
      } else {
        totalFrames += lineDelay;
      }
    }
    return totalFrames;
  };

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
          maxWidth: "1600px",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            backgroundColor: "#2D2A26",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#28C840" }} />
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "13px",
              color: "rgba(255,255,255,0.4)",
              marginLeft: "12px",
            }}
          >
            claude code
          </span>
        </div>
        <div
          style={{
            backgroundColor: "#1A1815",
            padding: "32px 36px",
            minHeight: "500px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {lines.map((line, index) => {
            const startFrame = getLineStartFrame(index);
            if (frame < startFrame) return null;

            const localFrame = frame - startFrame;

            if (line.type === "input") {
              const displayText = typewriter(localFrame, line.text, typingSpeed);
              const showCursor = displayText.length < line.text.length;
              return (
                <div key={index} style={{ display: "flex", alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: "22px",
                      color: "#D4A853",
                      marginRight: "12px",
                      fontWeight: 600,
                    }}
                  >
                    $
                  </span>
                  <span
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: "22px",
                      color: "#F8F6F2",
                      lineHeight: 1.6,
                    }}
                  >
                    {displayText}
                    {showCursor && (
                      <span
                        style={{
                          backgroundColor: "#D4A853",
                          width: "12px",
                          height: "26px",
                          display: "inline-block",
                          marginLeft: "2px",
                          opacity: Math.sin(localFrame * 0.3) > 0 ? 1 : 0,
                        }}
                      />
                    )}
                  </span>
                </div>
              );
            }

            const opacity = interpolate(localFrame, [0, 12], [0, 1], {
              extrapolateRight: "clamp",
            });

            return (
              <div key={index} style={{ opacity }}>
                <span
                  style={{
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: "20px",
                    color: line.text.startsWith("✓") || line.text.startsWith("Created") || line.text.startsWith("Deployed")
                      ? "#28C840"
                      : line.text.startsWith("Error") || line.text.startsWith("✗")
                        ? "#FF5F57"
                        : "rgba(248,246,242,0.6)",
                    lineHeight: 1.6,
                  }}
                >
                  {line.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
