import React, { useMemo, useEffect, useRef } from "react";
import { useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useSectionFrame } from "../lib/SectionContext";
import { LANDING_LIGHT } from "../lib/dashboard-theme";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";
import helvetikerRegular from "three/examples/fonts/helvetiker_regular.typeface.json";

const fontLoader = new FontLoader();
const boldFont = fontLoader.parse(helvetikerBold as any);
const regularFont = fontLoader.parse(helvetikerRegular as any);

const AnimatedCamera: React.FC = () => {
  const frame = useSectionFrame();
  const { camera } = useThree();

  const cam = camera as THREE.PerspectiveCamera;

  const z = interpolate(frame, [0, 30], [12, -3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const y = interpolate(frame, [0, 15, 30], [0, 1.5, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const x = interpolate(frame, [0, 30], [0, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fov = interpolate(frame, [0, 30], [45, 70], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  cam.position.set(x, y, z);
  cam.lookAt(0, 0.5, 0);
  cam.fov = fov;
  cam.updateProjectionMatrix();

  return null;
};

const MainText3D: React.FC = () => {
  const frame = useSectionFrame();
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new TextGeometry("What if it took minutes?", {
      font: boldFont,
      size: 1.2,
      depth: 0.3,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
    geo.computeBoundingBox();
    geo.center();
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#1A1815",
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
    });
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const rotY = interpolate(frame, [0, 30], [0, 0.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [20, 30], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  material.opacity = opacity;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, -0.5, 0]}
      rotation={[0, rotY, 0]}
    />
  );
};

const SubText3D: React.FC = () => {
  const frame = useSectionFrame();

  const geometry = useMemo(() => {
    const geo = new TextGeometry("Automating your business takes months.", {
      font: regularFont,
      size: 0.5,
      depth: 0.15,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    geo.computeBoundingBox();
    geo.center();
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#1A1815",
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
    });
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const opacity = interpolate(frame, [15, 30], [0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  material.opacity = opacity;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, 1.8, -0.5]}
    />
  );
};

const WarpScene: React.FC = () => {
  return (
    <>
      <AnimatedCamera />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, -2, 4]} intensity={0.3} />
      <MainText3D />
      <SubText3D />
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
