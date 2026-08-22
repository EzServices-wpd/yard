"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile, historicStrokes, homeOf, hullStrokes } from "@/lib/yard/ghost";
import { stepInstanceIds } from "@/lib/yard/assembly";
import { isFrameRole, isSkinRole } from "@/lib/yard/joints";
import type { DetailLevel, Vec3, WorkMode, YardProject } from "@/lib/yard/types";
import { WalkRig } from "@/components/workspace/walk-rig";
import { StickCloud, PanelMesh } from "@/components/workspace/stick-cloud";

const HULL = "#8a8478";
const HIST = "#d7cbb6";

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
  const stepIds = useMemo(() => (step ? stepInstanceIds(project, step) : []), [step, project]);
  const useShadows = project.instances.length + project.panels.length < 180;

  return (
    <div className="absolute inset-0">
      <Canvas
        key={project.id}
        camera={{ position: [48, 32, 48], fov: 34, near: 0.1, far: 4000 }}
        shadows={useShadows}
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
        <directionalLight position={[36, 64, 28]} intensity={1.35} color="#fff4e4" castShadow={useShadows} shadow-mapSize={[1024, 1024]} />
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
        <Grid args={[80, 80]} cellSize={8} cellThickness={0.28} cellColor="#1a1612" sectionSize={24} sectionThickness={0.5} sectionColor="#2a241e" fadeDistance={80} fadeStrength={2.2} infiniteGrid position={[0, 0, 0]} />
        <OrbitControls makeDefault enabled={workMode !== "walk"} enableDamping dampingFactor={0.08} minDistance={6} maxDistance={480} target={[0, 14, 0]} />
        <CameraRig project={project} preset={camera} stepIds={stepIds} locked={workMode === "walk"} />
        {workMode === "walk" && project.traverse && <WalkRig traverse={project.traverse} />}
      </Canvas>
    </div>
  );
}

function focusOf(project: YardProject, stepIds?: string[]) {
  const hot = new Set(stepIds ?? []);
  if (project.instances.length) {
    const list = hot.size ? project.instances.filter((i) => hot.has(i.id)) : project.instances;
    const use = list.length ? list : project.instances;
    let x = 0, y = 0, z = 0;
    for (const i of use) {
      const p = homeOf(i);
      x += p.x; y += p.y; z += p.z;
    }
    const n = use.length;
    return { x: x / n, y: y / n, z: z / n };
  }
  return { x: 0, y: Math.max(project.overall.height, 12) * 0.4, z: 0 };
}

function CameraRig({
  project, preset, stepIds, locked,
}: {
  project: YardProject;
  preset: "iso" | "front" | "side" | "top";
  stepIds: string[];
  locked: boolean;
}) {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (locked) return;
    const h = Math.max(project.overall.height, 12);
    const fit = Math.max(h, project.overall.width, project.overall.depth, 12);
    const dist = fit * 1.55;
    const focus = focusOf(project, stepIds);
    const presets: Record<typeof preset, [number, number, number]> = {
      iso: [focus.x + dist * 0.92, focus.y * 0.55 + 8, focus.z + dist * 0.92],
      front: [focus.x, focus.y, focus.z + dist * 1.28],
      side: [focus.x + dist * 1.28, focus.y, focus.z],
      top: [focus.x, focus.y + fit * 1.35, focus.z + 0.01],
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
  }, [preset, project.id, project.overall, project.instances.length, stepIds.join("|"), camera, controls, locked]);
  return null;
}

function GhostLines({ strokes, color }: { strokes: ReturnType<typeof hullStrokes>; color: string }) {
  return (
    <group>
      {strokes.map((s, i) => (
        <Line key={`${color}-${i}`} points={s.points} color={color} lineWidth={s.weight === "main" ? 1.4 : 0.8} transparent opacity={s.weight === "main" ? 0.55 : 0.32} depthWrite={false} />
      ))}
    </group>
  );
}

function MeasureGhost({ width, height, depth }: { width: number; height: number; depth: number }) {
  const hx = width / 2, hz = depth / 2;
  const pts: [number, number, number][][] = [
    [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-hx, 0, -hz]],
    [[-hx, height, -hz], [hx, height, -hz], [hx, height, hz], [-hx, height, hz], [-hx, height, -hz]],
    [[-hx, 0, -hz], [-hx, height, -hz]],
    [[hx, 0, -hz], [hx, height, -hz]],
    [[hx, 0, hz], [hx, height, hz]],
    [[-hx, 0, hz], [-hx, height, hz]],
  ];
  return (
    <group>
      {pts.map((p, i) => (
        <Line key={i} points={p} color="#c4b49a" lineWidth={1.2} transparent opacity={0.7} depthWrite={false} />
      ))}
    </group>
  );
}

function BenchScene({
  project, explode, selectedId, onSelect, onPlace, showHull, showHistoric, workMode, stepIds, placedIds, lockedIds, dragPos, measureOpen, measure, pending, detail, joinMethod, useShadows,
}: {
  project: YardProject;
  explode: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPlace: (catalogId: string, pos: Vec3) => void;
  showHull: boolean;
  showHistoric: boolean;
  workMode: WorkMode;
  stepIds: string[];
  placedIds: string[];
  lockedIds: string[];
  dragPos: { id: string; pos: Vec3 } | null;
  measureOpen: boolean;
  measure: { width: string; height: string; depth: string };
  pending: boolean;
  detail: DetailLevel;
  joinMethod?: YardProject["joinMethod"];
  useShadows: boolean;
}) {
  const explodeScale = explode ? 1.35 : 1;
  const hull = useMemo(() => (showHull ? hullStrokes(project) : []), [showHull, project]);
  const historic = useMemo(() => (showHistoric ? historicStrokes(project) : []), [showHistoric, project]);
  const mw = parseFloat(measure.width) || 0;
  const mh = parseFloat(measure.height) || 0;
  const md = parseFloat(measure.depth) || 0;
  const members =
    detail === "frame"
      ? project.instances.filter((i) => isFrameRole(i.role))
      : detail === "full"
        ? project.instances.filter((i) => !isSkinRole(i.role))
        : project.instances;

  return (
    <group>
      {showHull && <GhostLines strokes={hull} color={HULL} />}
      {showHistoric && <GhostLines strokes={historic} color={HIST} />}
      {measureOpen && mw > 0 && mh > 0 && <MeasureGhost width={mw} height={mh} depth={md || 16} />}
      {!pending && (
        <StickCloud
          instances={members}
          explode={explodeScale}
          selectedId={selectedId}
          workMode={workMode}
          stepIds={stepIds}
          placedIds={placedIds}
          lockedIds={lockedIds}
          dragPos={dragPos}
          overall={project.overall}
          onSelect={onSelect}
          joinMethod={joinMethod}
          useShadows={useShadows}
        />
      )}
      {!pending &&
        project.panels
          .filter((panel) => detail !== "frame" || panel.type !== "deck")
          .map((panel) => (
            <PanelMesh
              key={panel.id}
              panel={panel}
              explode={explodeScale}
              selected={panel.id === selectedId}
              inStep={stepIds.length ? stepIds.includes(panel.id) : false}
              hasStep={stepIds.length > 0}
              onSelect={() => onSelect(panel.id)}
              useShadows={useShadows}
            />
          ))}
      {workMode === "free" && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          onPointerDown={(e) => {
            if (e.delta > 2) return;
            e.stopPropagation();
            const x = Math.round(e.point.x * 4) / 4;
            const z = Math.round(e.point.z * 4) / 4;
            onPlace(project.primaryMaterialId, { x, y: 0, z });
          }}
        >
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}
