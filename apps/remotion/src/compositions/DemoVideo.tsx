import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { dipToDark, lateralSlide, scalePunchExit, wipeProgress, animatedCounter } from "../lib/animations";
import { SectionProvider } from "../lib/SectionContext";
import { T } from "../lib/timeline";
import { InterstitialCard } from "../components/InterstitialCard";
import { OpeningOverlay } from "../components/landing/OpeningOverlay";
import { LandingHeroMock } from "../components/landing/LandingHeroMock";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { StudioWithInput } from "../components/dashboard/StudioWithInput";
import { CameraContainer } from "../components/CameraContainer";
import { AgentsPageMock } from "../components/pages/AgentsPageMock";
import { ConversationMock } from "../components/pages/ConversationMock";
import { EvalRunMock } from "../components/pages/EvalRunMock";
import { MultiChannelScene } from "../components/MultiChannelScene";
import { EvalPromptScene } from "../components/EvalPromptScene";
import { EndCard } from "../components/EndCard";

const evalCases = [
  { name: "Standard cleaning booking", pass: true, duration: "1.2s" },
  { name: "Whitening consultation", pass: true, duration: "0.8s" },
  { name: "Emergency after-hours", pass: true, duration: "1.5s" },
  { name: "Double booking prevention", pass: true, duration: "2.1s" },
  { name: "Same-day cancellation", pass: true, duration: "0.9s" },
  { name: "Reschedule existing", pass: true, duration: "1.1s" },
  { name: "Weekend availability", pass: true, duration: "0.7s" },
  { name: "Multiple services", pass: true, duration: "1.3s" },
  { name: "New patient registration", pass: true, duration: "1.0s" },
  { name: "Follow-up scheduling", pass: true, duration: "0.8s" },
  { name: "Insurance inquiry", pass: true, duration: "1.4s" },
  { name: "Waitlist when full", pass: true, duration: "1.6s" },
  { name: "After-hours redirect", pass: true, duration: "1.1s" },
  { name: "Reminder confirmation", pass: true, duration: "0.9s" },
  { name: "No-show rescheduling", pass: true, duration: "1.2s" },
  { name: "Concurrent conflict", pass: true, duration: "2.3s" },
  { name: "Lunch break blocking", pass: true, duration: "0.8s" },
  { name: "Multi-provider scheduling", pass: true, duration: "1.5s" },
  {
    name: "Australia Day holiday",
    pass: false,
    duration: "3.4s",
    expected: "Should recognize Jan 26 as public holiday",
    got: "Attempted to book on the holiday",
  },
  { name: "Patient data validation", pass: true, duration: "0.9s" },
];

const FeatureCallout: React.FC<{
  text: React.ReactNode;
  globalFrame: number;
  appearAt: number;
  disappearAt: number;
  fps: number;
  position: { x: number; y: number };
  align?: "left" | "right";
  fontSize?: number;
}> = ({ text, globalFrame, appearAt, disappearAt, fps, position, align = "left", fontSize = 24 }) => {
  if (globalFrame < appearAt || globalFrame > disappearAt) return null;
  const enterSpring = spring({
    frame: Math.max(0, globalFrame - appearAt),
    fps,
    config: { damping: 12, stiffness: 240, mass: 0.35 },
  });
  const exitProgress = globalFrame > disappearAt - 8
    ? interpolate(globalFrame, [disappearAt - 8, disappearAt], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const opacity = enterSpring * (1 - exitProgress);
  const slideY = (1 - enterSpring) * 30;
  const scale = 0.8 + 0.2 * enterSpring;
  const shimmerPos = interpolate(
    globalFrame - appearAt,
    [0, 60],
    [-100, 200],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const shimmerGlow = 0.15 + 0.1 * Math.sin(((globalFrame - appearAt) / 30) * Math.PI);

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        opacity,
        transform: `translateY(${slideY}px) scale(${scale})`,
        transformOrigin: "center center",
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #1B4F72, #2C7DA0)",
          borderRadius: 8,
          padding: "10px 20px",
          boxShadow: `0 8px 24px rgba(27, 79, 114, ${0.35 + shimmerGlow}), 0 2px 8px rgba(0,0,0,0.1), 0 0 ${shimmerGlow * 30}px rgba(44, 125, 160, ${shimmerGlow})`,
          position: "relative" as const,
          overflow: "hidden" as const,
        }}
      >
        <div
          style={{
            position: "absolute" as const,
            top: 0,
            left: `${shimmerPos}%`,
            width: "30%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
            pointerEvents: "none" as const,
          }}
        />
        <span
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize,
            fontWeight: 600,
            color: "#ffffff",
            whiteSpace: "nowrap",
            position: "relative" as const,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

export const DemoVideo: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const showLanding = f >= T.landing.start && f <= T.landing.end + 5;
  const showAgentCreation = f >= T.agentCreation.start && f <= T.agentCreation.end + 5;
  const showChat = f >= T.chat.start && f <= T.chat.end + 5;
  const showInter3 = f >= T.interstitial3.enter && f <= T.interstitial3.exit;
  const showEvalPrompt = f >= T.evalPrompt.start && f <= T.evalPrompt.end + 5;
  const showEval = f >= T.evalSuite.start && f <= T.evalSuite.end + 5;
  const showInter4 = f >= T.interstitial4.enter && f <= T.interstitial4.exit;
  const showMultiChannel = f >= T.multiChannel.start && f <= T.multiChannel.end + 5;
  const showEndCard = f >= T.endCard.start;

  const punchIn = (triggerFrame: number) => {
    const s = spring({
      frame: Math.max(0, f - triggerFrame),
      fps,
      config: { damping: 18, stiffness: 220, mass: 0.4 },
    });
    return 1.06 - 0.06 * s;
  };

  const hardOut = (exitStart: number, exitEnd: number) => {
    if (f < exitStart) return { opacity: 1, scale: 1 };
    const progress = interpolate(f, [exitStart, exitEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      opacity: 1 - progress,
      scale: 1 + 0.08 * progress,
    };
  };

  const landingExitRaw = interpolate(f, [T.landing.end - 10, T.landing.end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const landingExitY = -100 * (1 - Math.pow(1 - landingExitRaw, 3.5));
  const agentEnterRaw = interpolate(f, [T.agentCreation.start, T.agentCreation.start + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const agentEnterY = 100 * (1 - (1 - Math.pow(1 - agentEnterRaw, 3.5)));
  const chatExit = hardOut(T.chat.end - 15, T.chat.end);
  const agentSlideX = lateralSlide(f, T.agentCreation.end - 8, T.agentCreation.end, "left");
  const chatSlideX = lateralSlide(f, T.chat.start, T.chat.start + 8, "right");
  const evalExit = scalePunchExit(f, T.evalSuite.end - 25, T.evalSuite.end);
  const inter4Exit = hardOut(T.interstitial4.exit - 6, T.interstitial4.exit);
  const multiChannelExit = {
    opacity: interpolate(f, [T.multiChannel.end - 20, T.multiChannel.end], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    scale: interpolate(f, [T.multiChannel.end - 20, T.multiChannel.end], [1, 0.9], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };

  const darkOverlay = 0;
  const wipe = wipeProgress(f, T.interstitial4.exit - 15, T.interstitial4.exit);

  const landingEntrance = 1;
  const agentScale = punchIn(T.agentCreation.start);
  const chatScale = punchIn(T.chat.start);
  const evalScale = 1;
  const multiChannelScale = punchIn(T.multiChannel.start);
  const endCardScale = punchIn(T.endCard.start);

  return (
    <AbsoluteFill style={{ background: "#F8F6F2" }}>
      {showLanding && (
        <AbsoluteFill style={{
          transform: `translateY(${landingExitY}%)`,
        }}>
          <SectionProvider sectionStart={T.landing.start} sectionDuration={T.landing.duration}>
            <CameraContainer
              movements={[
                { startFrame: 40, endFrame: 65, from: { scale: 1, x: 960, y: 540 }, to: { scale: 2.2, x: 960, y: 750 } },
                { startFrame: 180, endFrame: 220, from: { scale: 2.2, x: 960, y: 750 }, to: { scale: 1.4, x: 960, y: 600 } },
              ]}
            >
              <LandingHeroMock
                headline="AI agents for business"
                tagline="BUILT FOR AI TO BUILD"
                promptText="Build a receptionist for my dental clinic"
                suggestions={[
                  { label: "Client support" },
                  { label: "Bookings" },
                  { label: "Collections" },
                  { label: "Multi-agent" },
                ]}
              />
            </CameraContainer>
            <OpeningOverlay />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showAgentCreation && (
        <AbsoluteFill style={{
          transform: `translateY(${agentEnterY}%) translateX(${agentSlideX}%) scale(${agentScale})`,
        }}>
          <SectionProvider sectionStart={T.agentCreation.start} sectionDuration={T.agentCreation.duration}>
            <CameraContainer
              movements={[
                { startFrame: 0, endFrame: 1, from: { scale: 5.5, x: 1580, y: 185 }, to: { scale: 5.5, x: 1580, y: 185 } },
                { startFrame: 30, endFrame: 100, from: { scale: 5.5, x: 1580, y: 185 }, to: { scale: 2.5, x: 1580, y: 250 } },
                { startFrame: 110, endFrame: 160, from: { scale: 2.5, x: 1580, y: 250 }, to: { scale: 1.4, x: 1440, y: 400 } },
                { startFrame: 195, endFrame: 220, from: { scale: 1.4, x: 1440, y: 400 }, to: { scale: 1, x: 960, y: 540 } },
              ]}
            >
              <DashboardShell
                activeTab="system"
                environment="development"
                studioOpen={true}
                studioContent={
                  <StudioWithInput
                    promptText="Build a receptionist for my dental clinic"
                    promptStartFrame={0}
                    sendFrame={0}
                    skipEntrance
                    timeline={[
                      {
                        type: "thinking",
                        startFrame: 5,
                        text: "I'll create a dental receptionist agent with appointment scheduling capabilities...",
                      },
                      {
                        type: "toolCall",
                        startFrame: 45,
                        icon: "file",
                        title: "Write agents/receptionist.ts",
                        status: "completed",
                        badge: { text: "write", color: "green" },
                      },
                      {
                        type: "toolCall",
                        startFrame: 75,
                        icon: "file",
                        title: "Write entity-types/appointment.ts",
                        status: "completed",
                        badge: { text: "write", color: "green" },
                      },
                      {
                        type: "toolCall",
                        startFrame: 100,
                        icon: "search",
                        title: "Read project config",
                        status: "completed",
                        summary: "1 file",
                      },
                      {
                        type: "fileChange",
                        startFrame: 115,
                        path: "agents/receptionist.ts",
                        action: "write",
                        lines: [
                          '+ import { defineAgent } from "struere"',
                          "+",
                          "+ export default defineAgent({",
                          '+   name: "Dental Receptionist",',
                          '+   slug: "dental-receptionist",',
                          '+   model: { provider: "xai", name: "grok-4-1-fast" },',
                          '+   tools: ["entity.create", "entity.query", "entity.update"],',
                          "+ })",
                        ],
                      },
                      {
                        type: "assistant",
                        startFrame: 160,
                        text: "Done. Your agent is live with 3 tools enabled.",
                      },
                    ]}
                  />
                }
              >
                <AgentsPageMock
                  agents={[
                    {
                      name: "Dental Receptionist",
                      description: "Handles cleanings, whitening, and emergencies",
                      status: "active",
                    },
                  ]}
                  highlightIndex={0}
                  showAt={220}
                />
              </DashboardShell>
            </CameraContainer>
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showChat && (
        <AbsoluteFill style={{
          opacity: chatExit.opacity,
          transform: `translateX(${chatSlideX}%) scale(${chatScale * chatExit.scale})`,
        }}>
          <SectionProvider sectionStart={T.chat.start} sectionDuration={T.chat.duration}>
            <CameraContainer
              movements={[
                { startFrame: 260, endFrame: 285, from: { scale: 1, x: 960, y: 540 }, to: { scale: 2, x: 1500, y: 800 } },
              ]}
            >
              <DashboardShell activeTab="chats" environment="development" studioOpen={false}>
                <ConversationMock
                  agentName="Dental Receptionist"
                  contactName="Claudia Figueroa"
                  threadPreview="Hi, I need a cleaning on Thursday..."
                  messages={[
                    {
                      role: "user",
                      text: "Hi, I need a cleaning on Thursday please.",
                      startFrame: 30,
                    },
                    {
                      role: "agent",
                      text: "I'd be happy to help! I have availability at 2:00 PM on Thursday. Shall I book that for you?",
                      startFrame: 75,
                    },
                    {
                      role: "user",
                      text: "That works perfectly.",
                      startFrame: 125,
                    },
                    {
                      role: "agent",
                      text: "\u2713 Booked: Dental Cleaning\nThursday, 2:00 PM\nPatient: Claudia Figueroa\n\nSee you then! Please arrive 10 minutes early.",
                      startFrame: 170,
                      toolCalls: [
                        {
                          name: "entity.create",
                          args: {
                            type: "appointment",
                            patientName: "Claudia Figueroa",
                            service: "Dental Cleaning",
                            date: "Thu 2:00 PM",
                          },
                          result: { id: "apt_001", status: "confirmed" },
                        },
                      ],
                    },
                  ]}
                  showCalendarToastAt={235}
                  calendarToastText="Calendar event created: Thu 2:00 PM"
                  showWhatsAppToastAt={260}
                  whatsAppToastText="WhatsApp sent to Claudia Figueroa"
                />
              </DashboardShell>
            </CameraContainer>
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showInter3 && (
        <AbsoluteFill style={{
          opacity: interpolate(f, [T.interstitial3.exit - 2, T.interstitial3.exit], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          zIndex: 10,
        }}>
          <SectionProvider sectionStart={T.interstitial3.enter} sectionDuration={T.interstitial3.exit - T.interstitial3.enter}>
            <InterstitialCard headline="It tests and fixes itself." subtext="" />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showEvalPrompt && (
        <AbsoluteFill style={{
          opacity: interpolate(f, [T.evalPrompt.end - 10, T.evalPrompt.end], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}>
          <SectionProvider sectionStart={T.evalPrompt.start} sectionDuration={T.evalPrompt.duration}>
            <EvalPromptScene />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {darkOverlay > 0 && (
        <AbsoluteFill style={{ backgroundColor: "#1A1815", opacity: darkOverlay, zIndex: 15 }} />
      )}

      {showEval && (
        <AbsoluteFill style={{
          opacity: evalExit.opacity,
          transform: `scale(${evalScale * evalExit.scale})`,
        }}>
          <SectionProvider sectionStart={T.evalSuite.start} sectionDuration={T.evalSuite.duration}>
            <CameraContainer
              movements={[
                { startFrame: 0, endFrame: 1, from: { scale: 6.5, x: 1600, y: 180 }, to: { scale: 6.5, x: 1600, y: 180 } },
                { startFrame: 30, endFrame: 90, from: { scale: 6.5, x: 1600, y: 180 }, to: { scale: 2.5, x: 1580, y: 250 } },
                { startFrame: 110, endFrame: 140, from: { scale: 2.5, x: 1580, y: 250 }, to: { scale: 1.3, x: 720, y: 500 } },
                { startFrame: 250, endFrame: 270, from: { scale: 1.3, x: 720, y: 500 }, to: { scale: 2.2, x: 1680, y: 420 } },
                { startFrame: 340, endFrame: 355, from: { scale: 2.2, x: 1680, y: 420 }, to: { scale: 1.3, x: 720, y: 500 } },
              ]}
            >
              <DashboardShell
                activeTab="system"
                environment="development"
                studioOpen={true}
                studioContent={
                  <StudioWithInput
                    promptText="Write 20 eval scenarios for edge cases"
                    promptStartFrame={0}
                    sendFrame={0}
                    skipEntrance
                    timeline={[
                      {
                        type: "thinking",
                        startFrame: 8,
                        text: "Creating comprehensive eval suite...",
                      },
                      {
                        type: "toolCall",
                        startFrame: 30,
                        icon: "file",
                        title: "Write evals/receptionist-suite.ts",
                        status: "completed",
                        badge: { text: "write", color: "green" },
                      },
                      {
                        type: "assistant",
                        startFrame: 50,
                        text: "Created 20 eval scenarios. Running the suite now...",
                      },
                      {
                        type: "assistant",
                        startFrame: 275,
                        text: "19/20 passed. The agent doesn't recognize Australian public holidays. I'll fix the prompt.",
                      },
                      {
                        type: "toolCall",
                        startFrame: 305,
                        icon: "edit",
                        title: "Patch agents/receptionist.ts",
                        status: "completed",
                        badge: { text: "patch", color: "amber" },
                      },
                      {
                        type: "assistant",
                        startFrame: 325,
                        text: "Fixed. Rerunning the eval suite...",
                      },
                    ]}
                  />
                }
              >
                <EvalRunMock
                  suiteName="Receptionist Edge Cases"
                  cases={evalCases}
                  streamStartFrame={120}
                  streamSpeed={5}
                  failHighlightFrame={225}
                  rerunStartFrame={350}
                  rerunSpeed={2}
                />
              </DashboardShell>
            </CameraContainer>
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showInter4 && (
        <AbsoluteFill style={{
          opacity: inter4Exit.opacity,
          transform: `scale(${inter4Exit.scale})`,
          zIndex: 10,
        }}>
          <SectionProvider sectionStart={T.interstitial4.enter} sectionDuration={T.interstitial4.exit - T.interstitial4.enter}>
            <InterstitialCard headline="Deploy to any channel." subtext="" />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {wipe > 0 && wipe < 1 && (
        <AbsoluteFill style={{
          backgroundColor: "#F8F6F2",
          transform: `translateX(${(1 - wipe) * -100}%)`,
          zIndex: 9,
        }} />
      )}

      {showMultiChannel && (
        <AbsoluteFill style={{
          opacity: multiChannelExit.opacity,
          transform: `scale(${multiChannelScale * multiChannelExit.scale})`,
        }}>
          <SectionProvider sectionStart={T.multiChannel.start} sectionDuration={T.multiChannel.duration}>
            <MultiChannelScene />
          </SectionProvider>
        </AbsoluteFill>
      )}

      <FeatureCallout
        text="No code required"
        globalFrame={f}
        appearAt={T.agentCreation.start + 140}
        disappearAt={T.agentCreation.start + 220}
        fps={fps}
        position={{ x: 860, y: 960 }}
        fontSize={24}
      />
      <FeatureCallout
        text="Agent created. Fully functional."
        globalFrame={f}
        appearAt={T.agentCreation.start + 240}
        disappearAt={T.agentCreation.start + 320}
        fps={fps}
        position={{ x: 810, y: 960 }}
        fontSize={24}
      />
      <FeatureCallout
        text="Real-time conversations"
        globalFrame={f}
        appearAt={T.chat.start + 80}
        disappearAt={T.chat.start + 160}
        fps={fps}
        position={{ x: 830, y: 960 }}
        fontSize={24}
      />
      <FeatureCallout
        text="Automated actions"
        globalFrame={f}
        appearAt={T.chat.start + 265}
        disappearAt={T.chat.end - 30}
        fps={fps}
        position={{ x: 850, y: 960 }}
        fontSize={24}
      />
      <FeatureCallout
        text="19/20 passing"
        globalFrame={f}
        appearAt={T.evalSuite.start + 200}
        disappearAt={T.evalSuite.start + 270}
        fps={fps}
        position={{ x: 870, y: 960 }}
        fontSize={24}
      />
      <FeatureCallout
        text="Self-healing agents"
        globalFrame={f}
        appearAt={T.evalSuite.start + 310}
        disappearAt={T.evalSuite.start + 400}
        fps={fps}
        position={{ x: 845, y: 960 }}
        fontSize={24}
      />
      <FeatureCallout
        text="One agent, every channel"
        globalFrame={f}
        appearAt={T.multiChannel.start + 60}
        disappearAt={T.multiChannel.start + 140}
        fps={fps}
        position={{ x: 825, y: 960 }}
        align="left"
        fontSize={16}
      />

      {showEndCard && (
        <AbsoluteFill style={{
          transform: `scale(${endCardScale})`,
        }}>
          <SectionProvider sectionStart={T.endCard.start} sectionDuration={T.endCard.duration}>
            <EndCard />
          </SectionProvider>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
