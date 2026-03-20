import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { fadeIn } from "../lib/animations";
import { useSectionFrame } from "../lib/SectionContext";
import { FONTS } from "../lib/dashboard-theme";

export const MultiChannelScene: React.FC = () => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const phoneSlide = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.5 },
  });

  const browserSlide = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.5 },
  });

  const springMsg = (startAt: number, isRight: boolean) => {
    const localF = Math.max(0, frame - startAt);
    const s = spring({
      frame: localF,
      fps,
      config: { damping: 12, stiffness: 240, mass: 0.35 },
    });
    const opacity = interpolate(frame, [startAt, startAt + 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const slideY = (1 - s) * 24;
    const slideX = isRight ? (1 - s) * 30 : (1 - s) * -30;
    const scale = 0.9 + 0.1 * s;
    return { opacity, slideY, slideX, scale, origin: isRight ? "right bottom" : "left bottom" };
  };

  const chatMsg1 = springMsg(55, true);
  const chatMsg2 = springMsg(75, false);
  const chatMsg3 = springMsg(95, true);

  const waMsg1 = springMsg(35, true);
  const waMsg2 = springMsg(55, false);
  const waMsg3 = springMsg(75, true);

  const labelOpacity = fadeIn(frame, 100);

  const gradientOffset = interpolate(frame, [0, 250], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "80px",
          position: "relative",
          zIndex: 2,
          width: "100%",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              width: "380px",
              height: "760px",
              borderRadius: "48px",
              backgroundColor: "#1A1815",
              boxShadow: "0 40px 80px rgba(0,0,0,0.3)",
              position: "relative",
              overflow: "hidden",
              border: "3px solid #2D2A26",
              transform: `translateX(${(1 - phoneSlide) * -120}px)`,
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
              <div style={{ flex: 1, padding: "80px 18px 18px", display: "flex", flexDirection: "column", gap: 12, justifyContent: "flex-end", paddingBottom: 24 }}>
                <div
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "85%",
                    backgroundColor: "#E7FFDB",
                    borderRadius: "12px 12px 4px 12px",
                    padding: "12px 16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    opacity: waMsg1.opacity,
                    transform: `translateY(${waMsg1.slideY}px) translateX(${waMsg1.slideX}px) scale(${waMsg1.scale})`,
                    transformOrigin: waMsg1.origin,
                  }}
                >
                  <span style={{ fontFamily: FONTS.sans, fontSize: "16px", color: "#1A1815", lineHeight: 1.4 }}>
                    Hi, I need a cleaning Thursday
                  </span>
                </div>

                <div
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "85%",
                    backgroundColor: "#DCF8C6",
                    borderRadius: "12px 12px 12px 4px",
                    padding: "12px 16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    opacity: waMsg2.opacity,
                    transform: `translateY(${waMsg2.slideY}px) translateX(${waMsg2.slideX}px) scale(${waMsg2.scale})`,
                    transformOrigin: waMsg2.origin,
                  }}
                >
                  <div style={{ fontFamily: FONTS.sans, fontSize: "13px", fontWeight: 700, color: "#075E54", marginBottom: 3 }}>
                    Sydney Dental Clinic
                  </div>
                  <span style={{ fontFamily: FONTS.sans, fontSize: "16px", color: "#1A1815", lineHeight: 1.4 }}>
                    2:00 PM works! Booked you in. See you Thursday.
                  </span>
                </div>

                <div
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "85%",
                    backgroundColor: "#E7FFDB",
                    borderRadius: "12px 12px 4px 12px",
                    padding: "12px 16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    opacity: waMsg3.opacity,
                    transform: `translateY(${waMsg3.slideY}px) translateX(${waMsg3.slideX}px) scale(${waMsg3.scale})`,
                    transformOrigin: waMsg3.origin,
                  }}
                >
                  <span style={{ fontFamily: FONTS.sans, fontSize: "16px", color: "#1A1815", lineHeight: 1.4 }}>
                    Perfect, thanks!
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: "22px",
              color: "#574F45",
              marginTop: "16px",
              opacity: labelOpacity,
            }}
          >
            WhatsApp
          </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              width: "660px",
              height: "760px",
              borderRadius: "12px",
              backgroundColor: "#ffffff",
              boxShadow: "0 40px 80px rgba(0,0,0,0.2)",
              overflow: "hidden",
              border: "1px solid #D4CEC2",
              transform: `translateX(${(1 - browserSlide) * 120}px)`,
              opacity: browserSlide,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                height: "44px",
                backgroundColor: "#1A1815",
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                gap: "6px",
                flexShrink: 0,
              }}
            >
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#FF5F57" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#FEBC2E" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#28C840" }} />
              <div
                style={{
                  flex: 1,
                  marginLeft: "12px",
                  height: "22px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "8px",
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  struere-dental.com
                </span>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #f5f0e8 0%, #ece7dd 100%)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                padding: "20px",
              }}
            >
              <div
                style={{
                  width: "440px",
                  height: "580px",
                  borderRadius: "16px",
                  backgroundColor: "rgba(20, 30, 50, 0.85)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "18px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1B4F72, #2C7DA0)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "18px", color: "#fff", fontFamily: FONTS.sans, fontWeight: 700 }}>S</span>
                  </div>
                  <span style={{ fontFamily: FONTS.sans, fontSize: "17px", color: "#fff", fontWeight: 600 }}>
                    Sydney Dental
                  </span>
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "80%",
                      padding: "14px 18px",
                      borderRadius: "14px 14px 4px 14px",
                      backgroundColor: "rgba(20, 30, 50, 0.45)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      opacity: chatMsg1.opacity,
                      transform: `translateY(${chatMsg1.slideY}px) translateX(${chatMsg1.slideX}px) scale(${chatMsg1.scale})`,
                      transformOrigin: chatMsg1.origin,
                    }}
                  >
                    <span style={{ fontFamily: FONTS.sans, fontSize: "16px", color: "#fff", lineHeight: 1.4 }}>
                      Do you have availability Thursday?
                    </span>
                  </div>

                  <div
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "80%",
                      padding: "14px 18px",
                      borderRadius: "14px 14px 14px 4px",
                      backgroundColor: "rgba(20, 30, 50, 0.45)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      opacity: chatMsg2.opacity,
                      transform: `translateY(${chatMsg2.slideY}px) translateX(${chatMsg2.slideX}px) scale(${chatMsg2.scale})`,
                      transformOrigin: chatMsg2.origin,
                    }}
                  >
                    <span style={{ fontFamily: FONTS.sans, fontSize: "16px", color: "#fff", lineHeight: 1.4 }}>
                      Yes! I have 2:00 PM open. Want me to book it?
                    </span>
                  </div>

                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "80%",
                      padding: "14px 18px",
                      borderRadius: "14px 14px 4px 14px",
                      backgroundColor: "rgba(20, 30, 50, 0.45)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      opacity: chatMsg3.opacity,
                      transform: `translateY(${chatMsg3.slideY}px) translateX(${chatMsg3.slideX}px) scale(${chatMsg3.scale})`,
                      transformOrigin: chatMsg3.origin,
                    }}
                  >
                    <span style={{ fontFamily: FONTS.sans, fontSize: "16px", color: "#fff", lineHeight: 1.4 }}>
                      Please do
                    </span>
                  </div>
                </div>

                <div style={{ padding: "10px 14px 8px" }}>
                  <div
                    style={{
                      height: "46px",
                      borderRadius: "10px",
                      background: "rgba(20, 30, 50, 0.3)",
                      border: "1px solid transparent",
                      backgroundClip: "padding-box",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: "14px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: -1,
                        borderRadius: "10px",
                        padding: "1px",
                        background: `linear-gradient(${gradientOffset}deg, #1B4F72, #2C7DA0, #D4A853, #E87461)`,
                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude",
                      }}
                    />
                    <span
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: "15px",
                        color: "rgba(255,255,255,0.35)",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      Ask anything...
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: "9px",
                      color: "rgba(255,255,255,0.25)",
                      textAlign: "center",
                      marginTop: "6px",
                    }}
                  >
                    Powered by Struere
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: "22px",
              color: "#574F45",
              marginTop: "16px",
              opacity: labelOpacity,
            }}
          >
            Web Widget
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
