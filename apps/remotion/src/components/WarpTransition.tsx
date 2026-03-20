import React, { useMemo, useEffect } from "react";
import { useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSectionFrame } from "../lib/SectionContext";
import { LANDING_LIGHT } from "../lib/dashboard-theme";

const AnimatedCamera: React.FC = () => {
  const frame = useSectionFrame();
  const { camera } = useThree();

  const cam = camera as THREE.PerspectiveCamera;

  const z = interpolate(frame, [0, 30], [8, -2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const y = interpolate(frame, [0, 15, 30], [0, 0.8, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fov = interpolate(frame, [0, 30], [50, 65], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const roll = interpolate(frame, [0, 30], [0, 0.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  cam.position.set(0, y, z);
  cam.rotation.z = roll;
  cam.fov = fov;
  cam.updateProjectionMatrix();

  return null;
};

const TextPlane: React.FC<{ frame: number }> = ({ frame }) => {
  const rotX = interpolate(frame, [0, 30], [0, 0.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const progress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(progress, [0, 0.1, 0.7, 1], [1, 1, 0.6, 0]);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d")!;

    ctx.clearRect(0, 0, 1024, 256);

    ctx.fillStyle = "#1A1815";
    ctx.font = "bold 72px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("What if it took minutes?", 512, 128);

    return c;
  }, []);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [canvas]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh
      position={[0, 0, 0]}
      rotation={[rotX, 0, 0]}
      scale={[1, 1, 1]}
    >
      <planeGeometry args={[8, 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const SubTextPlane: React.FC<{ frame: number }> = ({ frame }) => {
  const progress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(progress, [0, 0.1, 0.6, 1], [0.6, 0.6, 0.3, 0]);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext("2d")!;

    ctx.clearRect(0, 0, 1024, 128);

    ctx.fillStyle = "#574F45";
    ctx.font = "400 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Automating your business takes months.", 512, 64);

    return c;
  }, []);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [canvas]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh
      position={[0, 1.5, -1]}
      rotation={[0, 0, 0]}
      scale={[1, 1, 1]}
    >
      <planeGeometry args={[8, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const WarpScene: React.FC = () => {
  const frame = useSectionFrame();

  return (
    <>
      <AnimatedCamera />
      <SubTextPlane frame={frame} />
      <TextPlane frame={frame} />
    </>
  );
};

export const WarpTransition: React.FC = () => {
  const frame = useSectionFrame();
  const { width, height } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [24, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div style={{ width: "100%", height: "100%", opacity, background: LANDING_LIGHT.stoneBase }}>
      <ThreeCanvas width={width} height={height}>
        <WarpScene />
      </ThreeCanvas>
    </div>
  );
};
