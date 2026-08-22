"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useYard } from "@/lib/yard/store";
import { homeOf } from "@/lib/yard/ghost";
import type { YardProject } from "@/lib/yard/types";

function WorkshopEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

export function WorkspaceCanvas() {
  const project = useYard((s) => s.project);
  const camera = useYard((s) => s.camera);
  const select = useYard((s) => s.select);

  return (
    <div className="absolute inset-0">
      <Canvas
        key={project.id}
        camera={{ position: [48, 32, 48], fov: 34, near: 0.1, far: 4000 }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "default",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        frameloop="always"
        dpr={[1, 1.5]}
        style={{ display: "block", width: "100%", height: "100%" }}
        onCreated={({ camera: cam, gl, scene }) => {
          gl.setClearColor("#1a1612", 1);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.background = new THREE.Color("#1a1612");
          cam.lookAt(0, 14, 0);
        }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={["#1a1612"]} />
        <WorkshopEnv />
        <ambientLight intensity={0.28} />
        <hemisphereLight args={["#ffe8c8", "#1a1612", 0.55]} />
        <directionalLight position={[36, 64, 28]} intensity={1.35} color="#fff4e4" />
        <ContactShadows position={[0, 0.02, 0]} opacity={0.48} scale={90} blur={2.2} far={50} color="#0c0a08" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[240, 240]} />
          <meshStandardMaterial color="#241e18" roughness={0.92} metalness={0} />
        </mesh>
        <Grid
          args={[80, 80]}
          cellSize={8}
          cellThickness={0.28}
          cellColor="#1a1612"
          sectionSize={24}
          sectionThickness={0.5}
          sectionColor="#2a241e"
          fadeDistance={80}
          fadeStrength={2.2}
          infiniteGrid
          position={[0, 0, 0]}
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={6} maxDistance={480} target={[0, 14, 0]} />
        <CameraRig project={project} preset={camera} />
      </Canvas>
    </div>
  );
}

function CameraRig({
  project,
  preset,
}: {
  project: YardProject;
  preset: "iso" | "front" | "side" | "top";
}) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const h = Math.max(project.overall.height, 12);
    const focus =
      project.instances.length > 0
        ? (() => {
            let x = 0,
              y = 0,
              z = 0;
            for (const i of project.instances) {
              const p = homeOf(i);
              x += p.x;
              y += p.y;
              z += p.z;
            }
            const n = project.instances.length;
            return { x: x / n, y: y / n, z: z / n };
          })()
        : { x: 0, y: h * 0.4, z: 0 };
    const dist = Math.max(h, project.overall.width, project.overall.depth, 12) * 1.5;
    const presets: Record<typeof preset, [number, number, number]> = {
      iso: [focus.x + dist * 0.92, focus.y * 0.55 + 8, focus.z + dist * 0.92],
      front: [focus.x, focus.y, focus.z + dist * 1.28],
      side: [focus.x + dist * 1.28, focus.y, focus.z],
      top: [focus.x, focus.y + dist, focus.z + 0.01],
    };
    const [x, y, z] = presets[preset];
    camera.position.set(x, y, z);
    const tgt = new THREE.Vector3(focus.x, focus.y, focus.z);
    camera.lookAt(tgt);
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (orbit?.target) {
      orbit.target.copy(tgt);
      orbit.update?.();
    }
  }, [preset, project.id, project.overall, project.instances.length, camera, controls]);
  return null;
}
