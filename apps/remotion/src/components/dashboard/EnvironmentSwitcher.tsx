import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { fadeIn, fadeOut, feedIn } from "../../lib/animations";

interface EnvironmentSwitcherProps {
  current: "development" | "production";
  dropdownOpenAt?: number;
  switchAt?: number;
}

export const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({
  current,
  dropdownOpenAt = 9999,
  switchAt = 9999,
}) => {
  const frame = useCurrentFrame();

  const hasDropdown = frame >= dropdownOpenAt;
  const hasSwitched = frame >= switchAt;

  const dropdownAnim = hasDropdown && !hasSwitched ? feedIn(frame, dropdownOpenAt) : null;
  const dropdownFadeOut = hasSwitched ? fadeOut(frame, switchAt, 10) : 1;

  const showDropdown = hasDropdown && dropdownFadeOut > 0;

  const dotColor = hasSwitched
    ? interpolate(frame, [switchAt, switchAt + 15], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const devR = 0xd4, devG = 0xa8, devB = 0x53;
  const prodR = 0x22, prodG = 0xc5, prodB = 0x5e;

  const currentDotR = Math.round(devR + (prodR - devR) * dotColor);
  const currentDotG = Math.round(devG + (prodG - devG) * dotColor);
  const currentDotB = Math.round(devB + (prodB - devB) * dotColor);
  const currentDotColor = hasSwitched
    ? `rgb(${currentDotR}, ${currentDotG}, ${currentDotB})`
    : current === "development"
      ? "#D4A853"
      : "#22c55e";

  const displayEnv = hasSwitched && dotColor >= 0.5 ? "production" : current;
  const displayLabel = displayEnv === "development" ? "Development" : "Production";

  const rippleProgress = hasSwitched
    ? interpolate(frame, [switchAt, switchAt + 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const rippleSpread = interpolate(rippleProgress, [0, 1], [4, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(rippleProgress, [0, 1], [0.3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleShadow =
    hasSwitched && rippleProgress < 1
      ? `0 0 0 ${rippleSpread}px rgba(34, 197, 94, ${rippleOpacity})`
      : "none";

  const isSelectingProd = hasDropdown && !hasSwitched && current === "development";
  const isSelectingDev = hasDropdown && !hasSwitched && current === "production";

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div
        style={{
          height: 28,
          backgroundColor: DASHBOARD.backgroundTertiary,
          border: `1px solid ${DASHBOARD.border}`,
          borderRadius: 9999,
          padding: "0 10px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          boxShadow: rippleShadow,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: currentDotColor,
          }}
        />
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            color: DASHBOARD.contentSecondary,
            lineHeight: 1,
          }}
        >
          {displayLabel}
        </span>
      </div>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 0,
            width: 180,
            backgroundColor: DASHBOARD.backgroundSecondary,
            border: `1px solid ${DASHBOARD.border}`,
            borderRadius: 8,
            padding: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            opacity: dropdownAnim
              ? dropdownAnim.opacity * dropdownFadeOut
              : dropdownFadeOut,
            transform: dropdownAnim
              ? `translateY(${dropdownAnim.translateY}px)`
              : undefined,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: isSelectingProd
                ? "rgba(255,255,255,0.05)"
                : "transparent",
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>
              🌐
            </span>
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                color: DASHBOARD.contentPrimary,
                flex: 1,
              }}
            >
              Production
            </span>
            {current === "production" && (
              <span
                style={{
                  fontSize: 14,
                  color: "#22c55e",
                  lineHeight: 1,
                }}
              >
                ✓
              </span>
            )}
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: isSelectingDev
                ? "rgba(255,255,255,0.05)"
                : "transparent",
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>
              ⟨/⟩
            </span>
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                color: DASHBOARD.contentPrimary,
                flex: 1,
              }}
            >
              Development
            </span>
            {current === "development" && (
              <span
                style={{
                  fontSize: 14,
                  color: "#22c55e",
                  lineHeight: 1,
                }}
              >
                ✓
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
