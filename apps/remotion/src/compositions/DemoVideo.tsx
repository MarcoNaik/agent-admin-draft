import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { zoomBlur } from "../lib/transitions/zoomBlur";
import { ProblemHook } from "../components/ProblemHook";
import { InterstitialCard } from "../components/InterstitialCard";
import { LandingHeroMock } from "../components/landing/LandingHeroMock";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { StudioWithInput } from "../components/dashboard/StudioWithInput";
import { CameraContainer } from "../components/CameraContainer";
import { AgentsPageMock } from "../components/pages/AgentsPageMock";
import { ConversationMock } from "../components/pages/ConversationMock";
import { EvalRunMock } from "../components/pages/EvalRunMock";
import { WhatsAppNotification } from "../components/WhatsAppNotification";
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

export const DemoVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={150}>
        <ProblemHook />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={240}>
        <CameraContainer
          movements={[
            { startFrame: 70, endFrame: 100, from: { scale: 1, x: 960, y: 540 }, to: { scale: 2.2, x: 960, y: 750 } },
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
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={75}>
        <InterstitialCard
          headline="Describe it. We build it."
          subtext=""
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={zoomBlur()}
        timing={linearTiming({ durationInFrames: 20 })}
      />

      <TransitionSeries.Sequence durationInFrames={270}>
        <CameraContainer
          movements={[
            { startFrame: 0, endFrame: 1, from: { scale: 2.5, x: 1680, y: 250 }, to: { scale: 2.5, x: 1680, y: 250 } },
            { startFrame: 60, endFrame: 85, from: { scale: 2.5, x: 1680, y: 250 }, to: { scale: 1.4, x: 1440, y: 400 } },
            { startFrame: 180, endFrame: 210, from: { scale: 1.4, x: 1440, y: 400 }, to: { scale: 1.3, x: 700, y: 500 } },
            { startFrame: 240, endFrame: 270, from: { scale: 1.3, x: 700, y: 500 }, to: { scale: 1, x: 960, y: 540 } },
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
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={75}>
        <InterstitialCard
          headline="Watch it work."
          subtext=""
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={360}>
        <CameraContainer
          movements={[
            { startFrame: 190, endFrame: 210, from: { scale: 1, x: 960, y: 540 }, to: { scale: 2, x: 1500, y: 300 } },
            { startFrame: 310, endFrame: 340, from: { scale: 2, x: 1500, y: 300 }, to: { scale: 1, x: 960, y: 540 } },
          ]}
        >
        <DashboardShell activeTab="chats" environment="development" studioOpen={false}>
          <ConversationMock
            agentName="Dental Receptionist"
            contactName="Sarah Chen"
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
                text: "\u2713 Booked: Dental Cleaning\nThursday, 2:00 PM\nPatient: Sarah Chen\n\nSee you then! Please arrive 10 minutes early.",
                startFrame: 133,
                toolCalls: [
                  {
                    name: "entity.create",
                    args: {
                      type: "appointment",
                      patientName: "Sarah Chen",
                      service: "Dental Cleaning",
                      date: "Thu 2:00 PM",
                    },
                    result: { id: "apt_001", status: "confirmed" },
                  },
                  {
                    name: "event.emit",
                    args: {
                      type: "appointment.created",
                      entityId: "apt_001",
                    },
                  },
                ],
              },
            ]}
            showToastAt={203}
            toastText="Appointment created: Sarah Chen - Dental Cleaning"
          />
        </DashboardShell>
        </CameraContainer>
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={75}>
        <InterstitialCard
          headline="Trust, but verify."
          subtext=""
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={zoomBlur()}
        timing={linearTiming({ durationInFrames: 20 })}
      />

      <TransitionSeries.Sequence durationInFrames={586}>
        <CameraContainer
          movements={[
            { startFrame: 0, endFrame: 20, from: { scale: 1, x: 960, y: 540 }, to: { scale: 4, x: 1680, y: 1010 } },
            { startFrame: 151, endFrame: 171, from: { scale: 4, x: 1680, y: 1010 }, to: { scale: 1, x: 960, y: 540 } },
            { startFrame: 316, endFrame: 346, from: { scale: 1, x: 960, y: 540 }, to: { scale: 3, x: 1680, y: 380 } },
            { startFrame: 451, endFrame: 478, from: { scale: 3, x: 1680, y: 380 }, to: { scale: 1, x: 960, y: 540 } },
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
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={75}>
        <InterstitialCard
          headline="One command to production."
          subtext=""
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={250}>
        <CameraContainer
          movements={[
            { startFrame: 44, endFrame: 61, from: { scale: 1, x: 960, y: 540 }, to: { scale: 4, x: 1680, y: 1010 } },
            { startFrame: 114, endFrame: 132, from: { scale: 4, x: 1680, y: 1010 }, to: { scale: 1, x: 960, y: 540 } },
          ]}
        >
          <DashboardShell
            activeTab="system"
            environment="production"
            studioOpen={true}
            studioContent={
              <StudioWithInput
                promptText="Deploy everything to production."
                promptStartFrame={44}
                sendFrame={114}
                timeline={[
                  {
                    type: "toolCall",
                    startFrame: 119,
                    icon: "terminal",
                    title: "struere deploy",
                    status: "completed",
                  },
                  {
                    type: "assistant",
                    startFrame: 141,
                    text: "\u2713 Deployed to production. 4 resources synced, 0 conflicts.",
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
              showAt={0}
            />
          </DashboardShell>
        </CameraContainer>
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={165}>
        <WhatsAppNotification
          sender="Sydney Dental Clinic"
          message="Your appointment is confirmed for Thursday at 2:00 PM. Sydney Dental, 42 George St. See you then!"
          dimBackground={true}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 20 })}
      />

      <TransitionSeries.Sequence durationInFrames={180}>
        <EndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
