import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";

interface EntityTableMockProps {
  typeName: string;
  columns: string[];
  rows: Array<{
    values: string[];
    statusIndex?: number;
    statusVariant?: "success" | "warning" | "active";
  }>;
  showRowsAt?: number;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  success: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
  warning: { bg: "rgba(234,179,8,0.1)", color: "#eab308" },
  active: { bg: "rgba(34,197,94,0.1)", color: "#22c55e" },
};

export const EntityTableMock: React.FC<EntityTableMockProps> = ({
  typeName,
  columns,
  rows,
  showRowsAt,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: DASHBOARD.backgroundPrimary,
        fontFamily: FONTS.sans,
      }}
    >
      <div
        style={{
          width: 200,
          flexShrink: 0,
          padding: "24px 16px",
          borderRight: `1px solid ${DASHBOARD.border}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: DASHBOARD.contentTertiary,
            marginBottom: 12,
          }}
        >
          Data Browser
        </div>
        <div
          style={{
            backgroundColor: "rgba(27, 79, 114, 0.1)",
            borderRadius: 6,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: DASHBOARD.ocean, fontSize: 14 }}>◆</span>
          <span
            style={{
              fontSize: 13,
              color: DASHBOARD.contentPrimary,
            }}
          >
            {typeName}
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 18,
            color: DASHBOARD.contentPrimary,
            fontWeight: 600,
          }}
        >
          {typeName}
        </div>
        <div
          style={{
            fontSize: 13,
            color: DASHBOARD.contentTertiary,
            marginTop: 4,
          }}
        >
          {rows.length} record{rows.length !== 1 ? "s" : ""}
        </div>

        <div
          style={{
            marginTop: 12,
            height: 36,
            backgroundColor: DASHBOARD.backgroundTertiary,
            border: `1px solid ${DASHBOARD.border}`,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontFamily: FONTS.input,
              color: DASHBOARD.contentTertiary,
            }}
          >
            Search...
          </span>
        </div>

        <div style={{ marginTop: 12, flex: 1, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              backgroundColor: DASHBOARD.backgroundSecondary,
              borderBottom: `1px solid ${DASHBOARD.border}`,
            }}
          >
            {columns.map((col) => (
              <div
                key={col}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: DASHBOARD.contentTertiary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontWeight: 500,
                }}
              >
                {col}
              </div>
            ))}
          </div>

          {rows.map((row, rowIndex) => {
            const rowStartFrame = showRowsAt !== undefined
              ? showRowsAt + rowIndex * 8
              : rowIndex * 8;
            const springProgress = frame >= rowStartFrame ? spring({
              frame: frame - rowStartFrame,
              fps: 30,
              config: { damping: 14, stiffness: 180, mass: 0.5 },
            }) : 0;
            const rowOpacity = Math.min(1, springProgress * 2);
            const rowTranslateY = (1 - springProgress) * 12;

            return (
              <div
                key={rowIndex}
                style={{
                  display: "flex",
                  height: 44,
                  alignItems: "center",
                  borderBottom: `1px solid ${DASHBOARD.border}`,
                  backgroundColor:
                    rowIndex % 2 === 1
                      ? "rgba(255,255,255,0.02)"
                      : "transparent",
                  opacity: rowOpacity,
                  transform: `translateY(${rowTranslateY}px)`,
                }}
              >
                {row.values.map((value, colIndex) => {
                  const isStatus = row.statusIndex === colIndex;
                  const variant = row.statusVariant ?? "success";
                  const statusStyle = STATUS_STYLES[variant];

                  return (
                    <div
                      key={colIndex}
                      style={{
                        flex: 1,
                        padding: "0 12px",
                        fontSize: 13,
                        color: DASHBOARD.contentPrimary,
                      }}
                    >
                      {isStatus ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 9999,
                            fontSize: 12,
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.color,
                          }}
                        >
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
