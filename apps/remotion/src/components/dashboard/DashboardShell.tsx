import React from "react";
import { DASHBOARD } from "../../lib/dashboard-theme";
import { DashboardHeader } from "./DashboardHeader";

interface DashboardShellProps {
  children: React.ReactNode;
  studioContent?: React.ReactNode;
  studioOpen?: boolean;
  activeTab?: "system" | "data" | "chats";
  environment?: "development" | "production";
}

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

const PRISMATIC_GRADIENT =
  "linear-gradient(180deg, #1B4F72, #2C7DA0, #D4A853, #E8C468, #D4A853, #2C7DA0, #1B4F72)";

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  studioContent,
  studioOpen = false,
  activeTab = "system",
  environment = "development",
}) => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        backgroundColor: DASHBOARD.background,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <DashboardHeader
        activeTab={activeTab}
        studioOpen={studioOpen}
        environment={environment}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: 24,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              flex: 1,
              backgroundColor: DASHBOARD.backgroundSecondary,
              border: `1px solid ${DASHBOARD.border}`,
              borderRadius: 12,
              padding: 24,
              overflow: "hidden",
            }}
          >
            {children}
          </div>
        </div>

        {studioOpen && (
          <div
            style={{
              width: 2,
              background: PRISMATIC_GRADIENT,
              flexShrink: 0,
            }}
          />
        )}

        <div
          style={{
            width: studioOpen ? 480 : 0,
            overflow: "hidden",
            backgroundColor: DASHBOARD.background,
            flexShrink: 0,
            transition: "width 0.3s ease",
          }}
        >
          {studioOpen && studioContent}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          pointerEvents: "none" as const,
          zIndex: 9999,
          opacity: 0.025,
        }}
      />
    </div>
  );
};
