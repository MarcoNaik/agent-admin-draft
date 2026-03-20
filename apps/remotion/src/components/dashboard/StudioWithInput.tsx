import React from "react";
import { StudioPanelMock } from "./StudioPanelMock";
import { StudioMessageFlow, type TimelineItem } from "./StudioMessageFlow";
import { useSectionFrame } from "../../lib/SectionContext";

interface StudioWithInputProps {
  promptText: string;
  promptStartFrame: number;
  promptSpeed?: number;
  sendFrame: number;
  timeline: TimelineItem[];
  skipEntrance?: boolean;
}

export const StudioWithInput: React.FC<StudioWithInputProps> = ({
  promptText,
  promptStartFrame,
  promptSpeed = 0.8,
  sendFrame,
  timeline,
  skipEntrance = false,
}) => {
  const frame = useSectionFrame();

  const typingFrame = Math.max(0, frame - promptStartFrame);
  const typedChars = Math.floor(typingFrame / promptSpeed);
  const isTyping = frame >= promptStartFrame && frame < sendFrame;
  const isSent = frame >= sendFrame;

  const inputDisplayText = isTyping
    ? promptText.substring(0, Math.min(typedChars, promptText.length))
    : undefined;

  const showCursor = isTyping && Math.floor(frame / 15) % 2 === 0;
  const inputWithCursor = inputDisplayText
    ? inputDisplayText + (showCursor ? "|" : "")
    : undefined;

  const showSend = isTyping && typedChars >= promptText.length * 0.8;

  const fullTimeline: TimelineItem[] = [
    ...(isSent
      ? [{ type: "user" as const, startFrame: sendFrame, text: promptText }]
      : []),
    ...timeline,
  ];

  return (
    <StudioPanelMock inputText={inputWithCursor} showSendButton={showSend} skipEntrance={skipEntrance}>
      <StudioMessageFlow timeline={fullTimeline} />
    </StudioPanelMock>
  );
};
