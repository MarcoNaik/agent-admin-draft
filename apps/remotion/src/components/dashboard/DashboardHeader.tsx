import React from "react";
import { interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { useSectionFrame } from "../../lib/SectionContext";

interface DashboardHeaderProps {
  activeTab?: "system" | "data" | "chats";
  studioOpen?: boolean;
  environment?: "development" | "production";
}

const tabs = [
  { key: "system", label: "System" },
  { key: "data", label: "Data" },
  { key: "chats", label: "Chats" },
] as const;

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab = "system",
  studioOpen = false,
  environment = "development",
}) => {
  const frame = useSectionFrame();
  const sweepWidth = environment === "production"
    ? interpolate(frame, [0, 15], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const scanLinePosition = environment === "production"
    ? interpolate(frame, [0, 20], [-5, 105], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : -10;
  const scanLineOpacity = environment === "production"
    ? interpolate(frame, [0, 5, 15, 20], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const envDot =
    environment === "development" ? DASHBOARD.amber : DASHBOARD.success;
  const envLabel =
    environment === "development" ? "Development" : "Production";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 48,
        backgroundColor: DASHBOARD.backgroundChrome,
        borderBottom: `1px solid ${DASHBOARD.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 18,
            fontWeight: 600,
            color: DASHBOARD.contentPrimary,
            lineHeight: 1,
          }}
        >
          Struere
        </span>
        <div
          style={{
            width: 1,
            height: 20,
            backgroundColor: DASHBOARD.border,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: DASHBOARD.backgroundSecondary,
            border: `1px solid ${DASHBOARD.border}`,
            borderRadius: 9999,
            padding: "4px 10px",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: DASHBOARD.contentTertiary,
              lineHeight: 1,
            }}
          >
            □
          </span>
          <span
            style={{
              fontSize: 13,
              color: DASHBOARD.contentSecondary,
              lineHeight: 1,
            }}
          >
            Sydney Dental
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <div
              key={tab.key}
              style={{
                position: "relative",
                padding: "0 16px",
                height: 48,
                display: "flex",
                alignItems: "center",
                cursor: "default",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: isActive ? DASHBOARD.contentPrimary : DASHBOARD.contentTertiary,
                  fontWeight: isActive ? 500 : 400,
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 16,
                    right: 16,
                    height: 2,
                    backgroundColor: DASHBOARD.ocean,
                    borderRadius: 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: DASHBOARD.contentTertiary,
            lineHeight: 1,
          }}
        >
          Docs
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 28,
            borderRadius: 6,
            backgroundColor: studioOpen ? DASHBOARD.ocean : DASHBOARD.backgroundSecondary,
            border: studioOpen
              ? `1px solid ${DASHBOARD.oceanLight}`
              : `1px solid ${DASHBOARD.border}`,
            cursor: "default",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: studioOpen ? DASHBOARD.primaryForeground : DASHBOARD.contentTertiary,
              lineHeight: 1,
            }}
          >
            ▶
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: DASHBOARD.backgroundSecondary,
            border: `1px solid ${DASHBOARD.border}`,
            borderRadius: 9999,
            padding: "4px 10px",
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: envDot,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: DASHBOARD.contentSecondary,
              lineHeight: 1,
            }}
          >
            {envLabel}
          </span>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: DASHBOARD.oceanLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            MR
          </span>
        </div>
      </div>
      {scanLineOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${scanLinePosition}%`,
            width: "10%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(44, 125, 160, 0.15), transparent)",
            zIndex: 11,
            pointerEvents: "none" as const,
          }}
        />
      )}
      {sweepWidth > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 2,
            width: `${sweepWidth}%`,
            backgroundColor: "#22c55e",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};
