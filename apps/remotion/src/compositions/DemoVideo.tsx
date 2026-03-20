import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { sectionOpacity, sceneTransform3D } from "../lib/animations";
import { SectionProvider } from "../lib/SectionContext";
import { T } from "../lib/timeline";
import { ProblemHook } from "../components/ProblemHook";
import { InterstitialCard } from "../components/InterstitialCard";
import { LandingHeroMock } from "../components/landing/LandingHeroMock";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { StudioWithInput } from "../components/dashboard/StudioWithInput";
import { CameraContainer } from "../components/CameraContainer";
import { AgentsPageMock } from "../components/pages/AgentsPageMock";
import { ConversationMock } from "../components/pages/ConversationMock";
import { EvalRunMock } from "../components/pages/EvalRunMock";
import { MultiChannelScene } from "../components/MultiChannelScene";
import { EndCard } from "../components/EndCard";
import { WarpTransition } from "../components/WarpTransition";

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

export const DemoVideo: React.FC = () => {
  const f = useCurrentFrame();

  const showProblemHook = f <= T.problemHook.end + 15;
  const showWarp = f >= T.warpTransition.start && f <= T.warpTransition.end;
  const showLanding = f >= T.landing.start - 15 && f <= T.landing.end + 15;
  const showAgentCreation = f >= T.agentCreation.start - 15 && f <= T.agentCreation.end + 15;
  const showChat = f >= T.chat.start - 15 && f <= T.chat.end + 15;
  const showEval = f >= T.evalSuite.start - 15 && f <= T.evalSuite.end + 15;
  const showMultiChannel = f >= T.multiChannel.start - 15 && f <= T.multiChannel.end + 15;
  const showEndCard = f >= T.endCard.start - 15;

  const problemHookOpacity = sectionOpacity(f, 0, 8, T.problemHook.end - 15, T.problemHook.end);
  const warpOpacity = sectionOpacity(f, T.warpTransition.start, T.warpTransition.start + 3, T.warpTransition.end - 5, T.warpTransition.end);
  const landingOpacity = sectionOpacity(f, T.landing.start, T.landing.start + 15, T.landing.end - 20, T.landing.end);
  const agentOpacity = sectionOpacity(f, T.agentCreation.start, T.agentCreation.start + 20, T.agentCreation.end - 20, T.agentCreation.end);
  const chatOpacity = sectionOpacity(f, T.chat.start, T.chat.start + 15, T.chat.end - 25, T.chat.end);
  const evalOpacity = sectionOpacity(f, T.evalSuite.start, T.evalSuite.start + 20, T.evalSuite.end - 25, T.evalSuite.end);
  const multiChannelOpacity = sectionOpacity(f, T.multiChannel.start, T.multiChannel.start + 15, T.multiChannel.end - 20, T.multiChannel.end);
  const endCardOpacity = sectionOpacity(f, T.endCard.start, T.endCard.start + 20, T.endCard.end, T.endCard.end);

  const inter1Opacity = sectionOpacity(f, T.interstitial1.enter, T.interstitial1.enter + 10, T.interstitial1.exit - 10, T.interstitial1.exit);
  const inter2Opacity = sectionOpacity(f, T.interstitial2.enter, T.interstitial2.enter + 10, T.interstitial2.exit - 10, T.interstitial2.exit);
  const inter3Opacity = sectionOpacity(f, T.interstitial3.enter, T.interstitial3.enter + 10, T.interstitial3.exit - 10, T.interstitial3.exit);
  const inter4Opacity = sectionOpacity(f, T.interstitial4.enter, T.interstitial4.enter + 10, T.interstitial4.exit - 10, T.interstitial4.exit);

  const landingTransform = sceneTransform3D(f, T.landing.start, T.landing.start + 18, "push");
  const agentTransform = sceneTransform3D(f, T.agentCreation.start, T.agentCreation.start + 20, "turnLeft");
  const chatTransform = sceneTransform3D(f, T.chat.start, T.chat.start + 20, "pull");
  const evalTransform = sceneTransform3D(f, T.evalSuite.start, T.evalSuite.start + 20, "tiltUp");
  const multiChannelTransform = sceneTransform3D(f, T.multiChannel.start, T.multiChannel.start + 20, "crane");
  const endCardTransform = sceneTransform3D(f, T.endCard.start, T.endCard.start + 20, "deepPush");

  return (
    <AbsoluteFill style={{ background: "#F8F6F2" }}>
      {showProblemHook && (
        <AbsoluteFill style={{ opacity: problemHookOpacity }}>
          <SectionProvider sectionStart={T.problemHook.start} sectionDuration={T.problemHook.duration}>
            <ProblemHook />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showWarp && (
        <AbsoluteFill style={{ opacity: warpOpacity, zIndex: 5 }}>
          <SectionProvider sectionStart={T.warpTransition.start} sectionDuration={T.warpTransition.duration}>
            <WarpTransition />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showLanding && (
        <AbsoluteFill style={{ opacity: landingOpacity, perspective: 1200 }}>
          <div style={{ width: "100%", height: "100%", transform: landingTransform, transformStyle: "preserve-3d" as const }}>
            <SectionProvider sectionStart={T.landing.start} sectionDuration={T.landing.duration}>
              <CameraContainer
                movements={[
                  { startFrame: 100, endFrame: 130, from: { scale: 1, x: 960, y: 540 }, to: { scale: 2.2, x: 960, y: 750 } },
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
            </SectionProvider>
          </div>
        </AbsoluteFill>
      )}

      {inter1Opacity > 0 && (
        <AbsoluteFill style={{ opacity: inter1Opacity, zIndex: 10 }}>
          <SectionProvider sectionStart={T.interstitial1.enter} sectionDuration={T.interstitial1.exit - T.interstitial1.enter}>
            <InterstitialCard headline="Describe it. We build it." subtext="" variant={1} />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showAgentCreation && (
        <AbsoluteFill style={{ opacity: agentOpacity, perspective: 1200 }}>
          <div style={{ width: "100%", height: "100%", transform: agentTransform, transformStyle: "preserve-3d" as const }}>
            <SectionProvider sectionStart={T.agentCreation.start} sectionDuration={T.agentCreation.duration}>
              <CameraContainer
                movements={[
                  { startFrame: 0, endFrame: 1, from: { scale: 2.5, x: 1680, y: 250 }, to: { scale: 2.5, x: 1680, y: 250 } },
                  { startFrame: 105, endFrame: 130, from: { scale: 2.5, x: 1680, y: 250, rotateX: 0 }, to: { scale: 1.4, x: 1440, y: 400, rotateX: 1.5 } },
                  { startFrame: 180, endFrame: 210, from: { scale: 1.4, x: 1440, y: 400 }, to: { scale: 1.3, x: 700, y: 500 } },
                  { startFrame: 240, endFrame: 270, from: { scale: 1.3, x: 700, y: 500, rotateY: -2 }, to: { scale: 1, x: 960, y: 540, rotateY: 0 } },
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
                      timeline={[
                        {
                          type: "thinking",
                          startFrame: 5,
                          text: "I'll create a dental receptionist agent with appointment scheduling capabilities...",
                        },
                        {
                          type: "toolCall",
                          startFrame: 40,
                          icon: "file",
                          title: "Write agents/receptionist.ts",
                          status: "completed",
                          badge: { text: "write", color: "green" },
                        },
                        {
                          type: "toolCall",
                          startFrame: 55,
                          icon: "file",
                          title: "Write entity-types/appointment.ts",
                          status: "completed",
                          badge: { text: "write", color: "green" },
                        },
                        {
                          type: "toolCall",
                          startFrame: 70,
                          icon: "search",
                          title: "Read project config",
                          status: "completed",
                          summary: "1 file",
                        },
                        {
                          type: "fileChange",
                          startFrame: 85,
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
                          startFrame: 140,
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
                    showAt={200}
                  />
                </DashboardShell>
              </CameraContainer>
            </SectionProvider>
          </div>
        </AbsoluteFill>
      )}

      {inter2Opacity > 0 && (
        <AbsoluteFill style={{ opacity: inter2Opacity, zIndex: 10 }}>
          <SectionProvider sectionStart={T.interstitial2.enter} sectionDuration={T.interstitial2.exit - T.interstitial2.enter}>
            <InterstitialCard headline="Watch it work." subtext="" variant={2} />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showChat && (
        <AbsoluteFill style={{ opacity: chatOpacity, perspective: 1200 }}>
          <div style={{ width: "100%", height: "100%", transform: chatTransform, transformStyle: "preserve-3d" as const }}>
            <SectionProvider sectionStart={T.chat.start} sectionDuration={T.chat.duration}>
              <CameraContainer
                movements={[
                  { startFrame: 210, endFrame: 230, from: { scale: 1, x: 960, y: 540, rotateX: 0 }, to: { scale: 2, x: 1500, y: 800, rotateX: 2 } },
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
                        startFrame: 24,
                      },
                      {
                        role: "agent",
                        text: "I'd be happy to help! I have availability at 2:00 PM on Thursday. Shall I book that for you?",
                        startFrame: 58,
                      },
                      {
                        role: "user",
                        text: "That works perfectly.",
                        startFrame: 111,
                      },
                      {
                        role: "agent",
                        text: "\u2713 Booked: Dental Cleaning\nThursday, 2:00 PM\nPatient: Claudia Figueroa\n\nSee you then! Please arrive 10 minutes early.",
                        startFrame: 155,
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
                    showCalendarToastAt={173}
                    calendarToastText="Calendar event created: Thu 2:00 PM"
                    showWhatsAppToastAt={195}
                    whatsAppToastText="WhatsApp sent to Claudia Figueroa"
                  />
                </DashboardShell>
              </CameraContainer>
            </SectionProvider>
          </div>
        </AbsoluteFill>
      )}

      {inter3Opacity > 0 && (
        <AbsoluteFill style={{ opacity: inter3Opacity, zIndex: 10 }}>
          <SectionProvider sectionStart={T.interstitial3.enter} sectionDuration={T.interstitial3.exit - T.interstitial3.enter}>
            <InterstitialCard headline="Test and iterate fast." subtext="" variant={3} />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showEval && (
        <AbsoluteFill style={{ opacity: evalOpacity, perspective: 1200 }}>
          <div style={{ width: "100%", height: "100%", transform: evalTransform, transformStyle: "preserve-3d" as const }}>
            <SectionProvider sectionStart={T.evalSuite.start} sectionDuration={T.evalSuite.duration}>
              <CameraContainer
                movements={[
                  { startFrame: 0, endFrame: 20, from: { scale: 1, x: 960, y: 540, rotateY: 0 }, to: { scale: 4, x: 1680, y: 1010, rotateY: -1 } },
                  { startFrame: 151, endFrame: 171, from: { scale: 4, x: 1680, y: 1010 }, to: { scale: 1, x: 960, y: 540 } },
                  { startFrame: 376, endFrame: 406, from: { scale: 1, x: 960, y: 540 }, to: { scale: 3, x: 1680, y: 380 } },
                  { startFrame: 481, endFrame: 508, from: { scale: 3, x: 1680, y: 380 }, to: { scale: 1, x: 960, y: 540 } },
                ]}
              >
                <DashboardShell
                  activeTab="system"
                  environment="development"
                  studioOpen={true}
                  studioContent={
                    <StudioWithInput
                      promptText="Write 20 eval scenarios for edge cases"
                      promptStartFrame={15}
                      sendFrame={151}
                      timeline={[
                        {
                          type: "thinking",
                          startFrame: 156,
                          text: "Creating comprehensive eval suite...",
                        },
                        {
                          type: "toolCall",
                          startFrame: 177,
                          icon: "file",
                          title: "Write evals/receptionist-suite.ts",
                          status: "completed",
                          badge: { text: "write", color: "green" },
                        },
                        {
                          type: "assistant",
                          startFrame: 186,
                          text: "Created 20 eval scenarios. Running the suite now...",
                        },
                        {
                          type: "assistant",
                          startFrame: 370,
                          text: "19/20 passed. The agent doesn't recognize Australian public holidays. I'll fix the prompt.",
                        },
                        {
                          type: "toolCall",
                          startFrame: 428,
                          icon: "edit",
                          title: "Patch agents/receptionist.ts",
                          status: "completed",
                          badge: { text: "patch", color: "amber" },
                        },
                        {
                          type: "assistant",
                          startFrame: 437,
                          text: "Fixed. Rerunning the eval suite...",
                        },
                      ]}
                    />
                  }
                >
                  <EvalRunMock
                    suiteName="Receptionist Edge Cases"
                    cases={evalCases}
                    streamStartFrame={181}
                    streamSpeed={8}
                    failHighlightFrame={334}
                    rerunStartFrame={451}
                    rerunSpeed={4}
                  />
                </DashboardShell>
              </CameraContainer>
            </SectionProvider>
          </div>
        </AbsoluteFill>
      )}

      {inter4Opacity > 0 && (
        <AbsoluteFill style={{ opacity: inter4Opacity, zIndex: 10 }}>
          <SectionProvider sectionStart={T.interstitial4.enter} sectionDuration={T.interstitial4.exit - T.interstitial4.enter}>
            <InterstitialCard headline="Deploy to any channel." subtext="" variant={4} />
          </SectionProvider>
        </AbsoluteFill>
      )}

      {showMultiChannel && (
        <AbsoluteFill style={{ opacity: multiChannelOpacity, perspective: 1200 }}>
          <div style={{ width: "100%", height: "100%", transform: multiChannelTransform, transformStyle: "preserve-3d" as const }}>
            <SectionProvider sectionStart={T.multiChannel.start} sectionDuration={T.multiChannel.duration}>
              <MultiChannelScene />
            </SectionProvider>
          </div>
        </AbsoluteFill>
      )}

      {showEndCard && (
        <AbsoluteFill style={{ opacity: endCardOpacity, perspective: 1200 }}>
          <div style={{ width: "100%", height: "100%", transform: endCardTransform, transformStyle: "preserve-3d" as const }}>
            <SectionProvider sectionStart={T.endCard.start} sectionDuration={T.endCard.duration}>
              <EndCard />
            </SectionProvider>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
