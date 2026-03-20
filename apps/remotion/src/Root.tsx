import { Composition } from "remotion";
import { DemoVideo } from "./compositions/DemoVideo";
import "./styles.css";

export const Root: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={1815}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
