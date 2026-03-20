import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface EvalResult {
  name: string;
  pass: boolean;
}

interface EvalResultsProps {
  results: EvalResult[];
  streamSpeed?: number;
  showFixAt?: number;
}

export const EvalResults: React.FC<EvalResultsProps> = ({
  results,
  streamSpeed = 8,
  showFixAt,
}) => {
  const frame = useCurrentFrame();

  const visibleCount = Math.min(Math.floor(frame / streamSpeed), results.length);
  const visibleResults = results.slice(0, visibleCount);

  const passCount = visibleResults.filter((r) => r.pass).length;
  const failCount = visibleResults.filter((r) => !r.pass).length;
  const total = results.length;

  const progressWidth = interpolate(visibleCount, [0, total], [0, 100], {
    extrapolateRight: "clamp",
  });

  const allDone = visibleCount >= total;
  const showFix = showFixAt !== undefined && frame > showFixAt;
  const fixedResults = results.map((r) => ({ ...r, pass: true }));
  const displayResults = showFix ? fixedResults : results;
  const displayVisible = showFix
    ? displayResults.slice(0, Math.min(Math.floor((frame - showFixAt) / streamSpeed), total))
    : visibleResults;

  const finalPassCount = showFix
    ? displayVisible.filter((r) => r.pass).length
    : passCount;
  const finalFailCount = showFix ? 0 : failCount;

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
            eval results
          </span>
        </div>
        <div
          style={{
            backgroundColor: "#1A1815",
            padding: "32px 36px",
            minHeight: "500px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: "16px",
                color: "rgba(248,246,242,0.6)",
              }}
            >
              <span>
                {showFix ? "Rerunning eval suite..." : "Running eval suite..."}
              </span>
              <span>
                {finalPassCount + finalFailCount}/{total}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${showFix ? interpolate(displayVisible.length, [0, total], [0, 100], { extrapolateRight: "clamp" }) : progressWidth}%`,
                  height: "100%",
                  backgroundColor: finalFailCount > 0 ? "#FEBC2E" : "#28C840",
                  borderRadius: "4px",
                  transition: "width 0.1s",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden", maxHeight: "380px" }}>
            {(showFix ? displayVisible : visibleResults).map((result, index) => {
              const resultPass = showFix ? true : result.pass;
              return (
                <div
                  key={`${showFix ? "fix" : "run"}-${index}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: "18px",
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{ color: resultPass ? "#28C840" : "#FF5F57" }}>
                    {resultPass ? "\u2713" : "\u2717"}
                  </span>
                  <span style={{ color: resultPass ? "rgba(248,246,242,0.8)" : "#FF5F57" }}>
                    {(showFix ? displayResults : results)[index].name}
                  </span>
                </div>
              );
            })}
          </div>

          {allDone && !showFix && failCount > 0 && (
            <div
              style={{
                marginTop: "20px",
                padding: "12px 20px",
                backgroundColor: "rgba(255,95,87,0.1)",
                borderRadius: "8px",
                border: "1px solid rgba(255,95,87,0.3)",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: "18px",
                color: "#FF5F57",
                opacity: interpolate(frame - total * streamSpeed, [0, 15], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
              }}
            >
              {passCount}/{total} passed \u00B7 {failCount} failed
            </div>
          )}

          {showFix && displayVisible.length >= total && (
            <div
              style={{
                marginTop: "20px",
                padding: "12px 20px",
                backgroundColor: "rgba(40,200,64,0.1)",
                borderRadius: "8px",
                border: "1px solid rgba(40,200,64,0.3)",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: "18px",
                color: "#28C840",
                opacity: interpolate(
                  frame - showFixAt - total * streamSpeed,
                  [0, 15],
                  [0, 1],
                  { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                ),
              }}
            >
              20/20 passed \u00B7 All scenarios green
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
