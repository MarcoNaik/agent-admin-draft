import React from "react";
import { useCurrentFrame } from "remotion";

const SectionFrameContext = React.createContext<{ frame: number; durationInFrames: number }>({ frame: 0, durationInFrames: 0 });

export const SectionProvider: React.FC<{
  sectionStart: number;
  sectionDuration: number;
  children: React.ReactNode;
}> = ({ sectionStart, sectionDuration, children }) => {
  const globalFrame = useCurrentFrame();
  const localFrame = Math.max(0, globalFrame - sectionStart);
  return (
    <SectionFrameContext.Provider value={{ frame: localFrame, durationInFrames: sectionDuration }}>
      {children}
    </SectionFrameContext.Provider>
  );
};

export const useSectionFrame = () => {
  return React.useContext(SectionFrameContext).frame;
};

export const useSectionDuration = () => {
  return React.useContext(SectionFrameContext).durationInFrames;
};
