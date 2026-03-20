import React from "react";
import { useVideoConfig, spring, interpolate } from "remotion";
import { DASHBOARD, FONTS } from "../../lib/dashboard-theme";
import { pulsingDot, glowPulse, animatedCounter } from "../../lib/animations";
import { PassRateMeter } from "../visualizations/PassRateMeter";
import { WarningFlash } from "../effects/WarningFlash";
import { useSectionFrame } from "../../lib/SectionContext";

function odometerValue(frame: number, targetStr: string, settleFrame: number): string {
  if (frame >= settleFrame + 10) return targetStr;
  if (frame < settleFrame) return targetStr;
  const localFrame = frame - settleFrame;
  const progress = localFrame / 10;
  if (progress >= 1) return targetStr;
  const digits = targetStr.split("").map((char) => {
    if (char >= "0" && char <= "9") {
      const target = parseInt(char, 10);
      const spin = Math.floor((1 - progress) * 20);
      return String((target + spin) % 10);
    }
    return char;
  });
  return digits.join("");
}

interface EvalCase {
  name: string;
  pass: boolean;
  duration: string;
  expected?: string;
  got?: string;
}

interface EvalRunMockProps {
  suiteName: string;
  cases: EvalCase[];
  streamStartFrame: number;
  streamSpeed: number;
  failHighlightFrame?: number;
  rerunStartFrame?: number;
  rerunSpeed?: number;
}

export const EvalRunMock: React.FC<EvalRunMockProps> = ({
  suiteName,
  cases,
  streamStartFrame,
  streamSpeed,
  failHighlightFrame,
  rerunStartFrame,
  rerunSpeed,
}) => {
  const frame = useSectionFrame();
  const { fps } = useVideoConfig();

  const namesSpeed = 2;
  const namesStartFrame = streamStartFrame - cases.length * namesSpeed - 10;

  const checkedCount = Math.min(
    Math.max(0, Math.floor((frame - streamStartFrame) / streamSpeed)),
    cases.length
  );

  const allChecked = checkedCount >= cases.length;
  const passCount = cases.slice(0, checkedCount).filter((c) => c.pass).length;
  const failCount = checkedCount - passCount;

  const isRerunning = rerunStartFrame !== undefined && frame >= rerunStartFrame;
  const rerunVisibleCount = isRerunning
    ? Math.min(
        Math.max(
          0,
          Math.floor(
            (frame - rerunStartFrame) / (rerunSpeed ?? streamSpeed)
          )
        ),
        cases.length
      )
    : 0;
  const rerunAllStreamed = rerunVisibleCount >= cases.length;

  const run1Status = allChecked
    ? failCount > 0
      ? "partial"
      : "done"
    : checkedCount > 0 || frame >= namesStartFrame
      ? "running"
      : "running";

  const run2Status = isRerunning
    ? rerunAllStreamed
      ? "done"
      : "running"
    : null;

  const tabs = ["Config", "Tools", "Evals", "Logs"];
  const subTabs = ["Runs", "Suites"];

  const renderStatusDot = (status: "running" | "done" | "partial") => {
    const dotScale = status === "running" ? pulsingDot(frame) : 1;
    const color =
      status === "done"
        ? DASHBOARD.success
        : status === "partial"
          ? DASHBOARD.amber
          : DASHBOARD.oceanLight;
    return (
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          transform: `scale(${dotScale})`,
        }}
      />
    );
  };

  const renderTableRow = (
    status: "running" | "done" | "partial",
    passRate: string,
    score: string,
    duration: string,
    isSuccess: boolean
  ) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 44,
        padding: "0 16px",
        borderBottom: `1px solid ${DASHBOARD.border}`,
        backgroundColor: isSuccess
          ? "rgba(34,197,94,0.05)"
          : "transparent",
      }}
    >
      <div style={{ width: 80, display: "flex", alignItems: "center" }}>
        {renderStatusDot(status)}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: 13,
          color: DASHBOARD.contentPrimary,
        }}
      >
        {suiteName}
      </div>
      <div
        style={{
          width: 100,
          fontSize: 13,
          color: DASHBOARD.contentSecondary,
        }}
      >
        Just now
      </div>
      <div
        style={{
          width: 80,
          fontSize: 13,
          fontFamily: FONTS.mono,
          color: DASHBOARD.contentPrimary,
        }}
      >
        {passRate}
      </div>
      <div
        style={{
          width: 80,
          fontSize: 13,
          fontFamily: FONTS.mono,
          color: DASHBOARD.contentPrimary,
        }}
      >
        {score}
      </div>
      <div
        style={{
          width: 80,
          fontSize: 13,
          fontFamily: FONTS.mono,
          color: DASHBOARD.contentTertiary,
        }}
      >
        {duration}
      </div>
    </div>
  );

  const renderCaseRow = (
    c: EvalCase,
    index: number,
    nameStartFrame: number,
    nameSpeed: number,
    resultStartFrame: number,
    resultSpeed: number,
    allPass: boolean
  ) => {
    const nameFrame = nameStartFrame + index * nameSpeed;
    const resultFrame = resultStartFrame + index * resultSpeed;

    const nameVisible = frame >= nameFrame;
    const resultVisible = frame >= resultFrame;

    if (!nameVisible) return null;

    const nameSpring = spring({
      frame: frame - nameFrame,
      fps: 30,
      config: { damping: 10, stiffness: 350, mass: 0.25 },
    });
    const animOpacity = Math.min(1, nameSpring * 3);
    const animTranslateY = (1 - nameSpring) * 24;
    const animScale = 0.92 + 0.08 * nameSpring;

    const pass = allPass ? true : c.pass;
    const showResult = resultVisible;

    const isFailedCase = showResult && !pass && !allPass;
    const impactScale = isFailedCase && frame >= resultFrame && frame < resultFrame + 15
      ? interpolate(frame, [resultFrame, resultFrame + 5, resultFrame + 15], [1.03, 1.03, 1.0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        })
      : 1;
    const impactShake = isFailedCase && frame >= resultFrame && frame < resultFrame + 12
      ? Math.sin((frame - resultFrame) * Math.PI * 2.5) * 2 * Math.max(0, 1 - (frame - resultFrame) / 12)
      : 0;

    const resultSpring = showResult
      ? spring({
          frame: frame - resultFrame,
          fps: 30,
          config: { damping: 8, stiffness: 400, mass: 0.2 },
        })
      : 0;
    const resultScale = showResult ? interpolate(resultSpring, [0, 1], [0, 1.15]) : 1;
    const resultSettleScale = showResult && resultSpring > 0.85
      ? spring({
          frame: Math.max(0, frame - resultFrame - 4),
          fps: 30,
          config: { damping: 15, stiffness: 300, mass: 0.3 },
        })
      : 0;
    const finalResultScale = showResult
      ? resultSpring > 0.85
        ? 1 + 0.15 * (1 - resultSettleScale)
        : resultScale
      : 1;
    const resultOpacity = showResult ? Math.min(1, resultSpring * 4) : 0;

    const showFailDetail =
      showResult &&
      !pass &&
      !allPass &&
      failHighlightFrame !== undefined &&
      frame >= failHighlightFrame &&
      c.expected !== undefined;

    return (
      <div key={`${index}-${allPass}`} style={{ opacity: animOpacity, transform: `translateY(${animTranslateY}px) translateX(${impactShake}px) scale(${impactScale * animScale})` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 36,
            padding: "0 12px",
            gap: 12,
            borderRadius: showResult && !pass ? 6 : 0,
            backgroundColor: showResult && !pass
              ? "rgba(239, 68, 68, 0.08)"
              : "transparent",
            border: showResult && !pass
              ? "1px solid rgba(239, 68, 68, 0.2)"
              : "1px solid transparent",
          }}
        >
          <div
            style={{
              fontSize: 14,
              width: 16,
              textAlign: "center" as const,
              color: !showResult
                ? DASHBOARD.contentTertiary
                : pass
                  ? DASHBOARD.success
                  : DASHBOARD.destructive,
              transform: showResult ? `scale(${finalResultScale})` : undefined,
              opacity: showResult ? resultOpacity : 0.5,
            }}
          >
            {!showResult ? "\u25CB" : pass ? "\u2713" : "\u2717"}
          </div>
          <div
            style={{
              flex: 1,
              fontSize: 13,
              color: DASHBOARD.contentPrimary,
              fontFamily: FONTS.sans,
            }}
          >
            {c.name}
          </div>
          {showResult && (
            <div
              style={{
                fontSize: 12,
                color: pass ? DASHBOARD.success : DASHBOARD.destructive,
                opacity: resultOpacity,
              }}
            >
              {pass ? "passed" : "failed"}
            </div>
          )}
          {showResult && (
            <div
              style={{
                fontSize: 12,
                fontFamily: FONTS.mono,
                color: DASHBOARD.contentTertiary,
                opacity: resultOpacity,
              }}
            >
              {c.duration}
            </div>
          )}
        </div>
        {showFailDetail && (
          <div
            style={{
              backgroundColor: "rgba(239,68,68,0.05)",
              padding: "8px 12px",
              marginLeft: 24,
              borderRadius: 4,
              marginTop: 2,
              marginBottom: 4,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  color: DASHBOARD.contentTertiary,
                }}
              >
                Expected:
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: DASHBOARD.contentPrimary,
                }}
              >
                {c.expected}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: DASHBOARD.contentTertiary,
                }}
              >
                Got:
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: DASHBOARD.destructive,
                }}
              >
                {c.got}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const run1PassRate = allChecked
    ? `${passCount}/${cases.length}`
    : checkedCount > 0
      ? `${passCount}/${checkedCount}`
      : `0/0`;
  const run1Score = allChecked
    ? `${Math.round((passCount / cases.length) * 100)}%`
    : "--";
  const run1Duration = allChecked ? "12.4s" : "--";

  const rerunCompletionFrame = rerunStartFrame !== undefined
    ? rerunStartFrame + cases.length * (rerunSpeed ?? streamSpeed)
    : 0;
  const celebrationTrigger = rerunCompletionFrame + 5;

  const celebrationGlow = rerunAllStreamed
    ? glowPulse(frame, celebrationTrigger, 2, 30)
    : 0;

  const celebrationScaleBounce = rerunAllStreamed
    ? (() => {
        const s = spring({
          frame: Math.max(0, frame - celebrationTrigger),
          fps,
          config: { damping: 8, stiffness: 300, mass: 0.4 },
        });
        return 1 + 0.08 * Math.sin(s * Math.PI);
      })()
    : 1;

  const rerunPassRate = rerunAllStreamed
    ? `${cases.length}/${cases.length}`
    : `${rerunVisibleCount}/${rerunVisibleCount}`;
  const rerunAnimatedScore = rerunAllStreamed
    ? `${animatedCounter(frame, celebrationTrigger, celebrationTrigger + 15, 95, 100)}%`
    : "--";
  const rerunScore = rerunAnimatedScore;
  const rerunDuration = rerunAllStreamed ? "8.2s" : "--";

  const run1SettleFrame = streamStartFrame + cases.length * streamSpeed;
  const animatedRun1PassRate = odometerValue(frame, run1PassRate, run1SettleFrame);
  const rerunSettleFrame = rerunStartFrame !== undefined ? rerunStartFrame + cases.length * (rerunSpeed ?? streamSpeed) : 0;
  const animatedRerunPassRate = rerunStartFrame !== undefined ? odometerValue(frame, rerunPassRate, rerunSettleFrame) : rerunPassRate;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "24px",
        backgroundColor: DASHBOARD.backgroundPrimary,
        fontFamily: FONTS.sans,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          zIndex: 10,
          transform: `scale(${celebrationScaleBounce})`,
          boxShadow: celebrationGlow > 0
            ? `0 0 ${celebrationGlow * 24}px rgba(34, 197, 94, ${celebrationGlow * 0.4})`
            : "none",
          borderRadius: "50%",
          backgroundColor: DASHBOARD.backgroundPrimary,
        }}
      >
        <PassRateMeter
          frame={frame}
          fps={fps}
          firstSweepStart={streamStartFrame}
          firstSweepEnd={streamStartFrame + cases.length * streamSpeed}
          firstTarget={checkedCount > 0 ? Math.round((passCount / cases.length) * 100) : 0}
          failFrame={failHighlightFrame}
          secondSweepStart={rerunStartFrame}
          secondSweepEnd={rerunStartFrame !== undefined ? rerunStartFrame + cases.length * (rerunSpeed ?? streamSpeed) : undefined}
          secondTarget={100}
        />
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 18,
          fontWeight: 600,
          color: DASHBOARD.contentPrimary,
        }}
      >
        Dental Receptionist
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          marginTop: 12,
          borderBottom: `1px solid ${DASHBOARD.border}`,
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab}
            style={{
              fontSize: 13,
              padding: "8px 16px",
              color:
                tab === "Evals"
                  ? DASHBOARD.contentPrimary
                  : DASHBOARD.contentTertiary,
              borderBottom:
                tab === "Evals"
                  ? `2px solid ${DASHBOARD.ocean}`
                  : "2px solid transparent",
              fontFamily: FONTS.sans,
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
        {subTabs.map((tab) => (
          <div
            key={tab}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              color:
                tab === "Runs"
                  ? DASHBOARD.contentPrimary
                  : DASHBOARD.contentTertiary,
              fontFamily: FONTS.sans,
              fontWeight: tab === "Runs" ? 600 : 400,
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {frame >= namesStartFrame && (
        failHighlightFrame !== undefined ? (
          <WarningFlash triggerFrame={failHighlightFrame}>
            <div
              style={{
                marginTop: 8,
                backgroundColor: DASHBOARD.backgroundPrimary,
                border: `1px solid ${DASHBOARD.border}`,
                borderRadius: 8,
                padding: 16,
              }}
            >
              {!isRerunning && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {cases.map((c, i) =>
                    renderCaseRow(c, i, namesStartFrame, namesSpeed, streamStartFrame, streamSpeed, false)
                  )}
                </div>
              )}

              {isRerunning && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {cases.map((c, i) =>
                    renderCaseRow(
                      c,
                      i,
                      namesStartFrame,
                      namesSpeed,
                      rerunStartFrame!,
                      rerunSpeed ?? streamSpeed,
                      true
                    )
                  )}
                </div>
              )}
            </div>
          </WarningFlash>
        ) : (
          <div
            style={{
              marginTop: 8,
              backgroundColor: DASHBOARD.backgroundPrimary,
              border: `1px solid ${DASHBOARD.border}`,
              borderRadius: 8,
              padding: 16,
            }}
          >
            {!isRerunning && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {cases.map((c, i) =>
                  renderCaseRow(c, i, namesStartFrame, namesSpeed, streamStartFrame, streamSpeed, false)
                )}
              </div>
            )}

            {isRerunning && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {cases.map((c, i) =>
                  renderCaseRow(
                    c,
                    i,
                    namesStartFrame,
                    namesSpeed,
                    rerunStartFrame!,
                    rerunSpeed ?? streamSpeed,
                    true
                  )
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
