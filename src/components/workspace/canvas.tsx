"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { getCatalogItem } from "@/lib/yard/catalog";
import { isCylindrical, isHollow, visualPrimitive } from "@/lib/yard/geometry";
import { stockLook } from "@/lib/yard/stockLook";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile, historicStrokes, homeOf, hullStrokes } from "@/lib/yard/ghost";
import { pilePosition, stepInstanceIds } from "@/lib/yard/assembly";
import { binderKind, classifyJoint, isFrameRole, isSkinRole, jointNodes } from "@/lib/yard/joints";
import type { DetailLevel, Panel, Vec3, WorkMode, YardInstance, YardProject } from "@/lib/yard/types";
import type { PrimitiveDims } from "@/lib/yard/geometry";
import { WalkRig } from "@/components/workspace/walk-rig";

const HULL = "#8a8478";
const HIST = "#d7cbb6";
const SLOT = "#f2ebe1";

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
  const explode = useYard((s) => s.explode);
  const selectedId = useYard((s) => s.selectedId);
  const camera = useYard((s) => s.camera);
  const select = useYard((s) => s.select);
  const placePiece = useYard((s) => s.placePiece);
  const showHull = useYard((s) => s.showHull);
  const showHistoric = useYard((s) => s.showHistoric);
  const workMode = useYard((s) => s.workMode);
  const activeStep = useYard((s) => s.activeStep);
  const placedIds = useYard((s) => s.placedIds);
  const lockedIds = useYard((s) => s.lockedIds);
  const dragPos = useYard((s) => s.dragPos);
  const plan = useYard((s) => s.plan);
  const measureOpen = useYard((s) => s.measureOpen);
  const measure = useYard((s) => s.measure);
  const building = useYard((s) => s.building);
  const grokBusy = useYard((s) => s.grokBusy);
  const detail = useYard((s) => s.detail);
  const pending = building || grokBusy;

  const step = plan?.instructions.find((s) => s.step === activeStep) ?? null;
  const stepIds = useMemo(
    () => (step ? stepInstanceIds(project, step) : []),
    [step, project],
  );
  const useShadows = project.instances.length + project.panels.length < 180;

  return (
    <div className="absolute inset-0">
      <Canvas
        key={project.id}
        camera={{ position: [48, 32, 48], fov: 34, near: 0.1, far: 4000 }}
        shadows={useShadows}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "default", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
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
        <directionalLight
          position={[36, 64, 28]}
          intensity={1.35}
          color="#fff4e4"
          castShadow={useShadows}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={2}
          shadow-camera-far={220}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={70}
          shadow-camera-bottom={-70}
          shadow-bias={-0.00025}
        />
        <directionalLight position={[-28, 22, -18]} intensity={0.28} color="#9bb4d4" />
        <ContactShadows position={[0, 0.02, 0]} opacity={0.48} scale={90} blur={2.2} far={50} color="#0c0a08" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[240, 240]} />
          <meshStandardMaterial color="#241e18" roughness={0.92} metalness={0} />
        </mesh>
        <BenchScene
          project={project}
          explode={explode}
          selectedId={selectedId}
          onSelect={select}
          onPlace={placePiece}
          showHull={showHull && !pending}
          showHistoric={showHistoric && !pending && (hasHistoricProfile(project.kind) || !!project.historic)}
          workMode={workMode}
          stepIds={stepIds}
          placedIds={placedIds}
          lockedIds={lockedIds}
          dragPos={dragPos}
          measureOpen={measureOpen}
          measure={measure}
          pending={pending}
          detail={detail}
          joinMethod={project.joinMethod}
          useShadows={useShadows}
        />
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
        <OrbitControls
          makeDefault
          enabled={workMode !== "walk"}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={480}
          target={[0, 14, 0]}
        />
        <CameraRig project={project} preset={camera} stepIds={stepIds} locked={workMode === "walk"} />
        {workMode === "walk" && project.traverse && <WalkRig traverse={project.traverse} />}
      </Canvas>
    </div>
  );
}
