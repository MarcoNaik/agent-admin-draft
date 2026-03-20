import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

type ZoomBlurProps = Record<string, never>;

const ZoomBlurPresentation: React.FC<
  TransitionPresentationComponentProps<ZoomBlurProps>
> = ({ children, presentationDirection, presentationProgress }) => {
  const isEntering = presentationDirection === "entering";

  if (isEntering) {
    return React.createElement(
      AbsoluteFill,
      { style: { opacity: presentationProgress } },
      children,
    );
  }

  const scale = 1 + presentationProgress * 0.3;
  const blur = presentationProgress * 8;
  const opacity = 1 - presentationProgress;

  return React.createElement(
    AbsoluteFill,
    {
      style: {
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        opacity,
      },
    },
    children,
  );
};

export const zoomBlur = (): TransitionPresentation<ZoomBlurProps> => {
  return {
    component: ZoomBlurPresentation,
    props: {} as ZoomBlurProps,
  };
};
