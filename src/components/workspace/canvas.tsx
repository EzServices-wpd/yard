"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile, historicStrokes, homeOf, hullStrokes } from "@/lib/yard/ghost";
import { stepInstanceIds } from "@/lib/yard/assembly";
import { isFrameRole, isSkinRole } from "@/lib/yard/joints";
import type { DetailLevel, Vec3, WorkMode, YardProject } from "@/lib/yard/types";
import { WalkRig } from "@/components/workspace/walk-rig";
import { StickCloud, PanelMesh, CarcaseJoins } from "@/components/workspace/stick-cloud";

const HULL = "#8a8478";
const HIST = "#d7cbb6";

function StudioLights({
  project,
  useShadows,
}: {
  project: YardProject;
  useShadows: boolean;
}) {
  const W = Math.max(project.overall.width, 16);
  const H = Math.max(project.overall.height, 16);
  const D = Math.max(project.overall.depth, 12);
  const span = Math.max(W, H, D);
  const fitted = project.panels.length > 0;
  const camSpan = Math.max(span * 0.75, 36);
  return (
    <>
      <ambientLight intensity={fitted ? 0.18 : 0.28} />
      <hemisphereLight args={["#ffe8c8", "#2a2218", fitted ? 0.36 : 0.48]} />
      <directionalLight
        position={[span * 0.55, Math.max(H * 1.25, 48), span * 0.42]}
        intensity={fitted ? 1.55 : 1.35}
        color="#fff3e0"
        castShadow={useShadows}
        shadow-mapSize={fitted ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.00018}
        shadow-normalBias={0.035}
        shadow-camera-near={1}
        shadow-camera-far={span * 5}
        shadow-camera-left={-camSpan}
        shadow-camera-right={camSpan}
        shadow-camera-top={camSpan}
        shadow-camera-bottom={-camSpan}
      />
      <directionalLight position={[-span * 0.65, H * 0.42, -span * 0.35]} intensity={fitted ? 0.38 : 0.28} color="#a8c0dc" />
      <directionalLight position={[span * 0.12, H * 0.85, -span * 0.75]} intensity={0.22} color="#ffd7a8" />
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={fitted ? 0.56 : 0.42}
        scale={Math.max(W, D) * 2.6 + 18}
        blur={fitted ? 1.55 : 2.3}
        far={Math.max(H * 0.35, 20)}
        color="#0c0a08"
      />
    </>
  );
}

/** Capture the live Canvas (lit parts for the active step) into plan.instructions[].imageDataUrl. */
function StepCapture() {
  const { gl, scene, camera } = useThree();
  const activeStep = useYard((s) => s.activeStep);
  const plan = useYard((s) => s.plan);
  const attachStepImage = useYard((s) => s.attachStepImage);
  const last = useRef<number | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if (activeStep == null || !plan) {
      last.current = null;
      tries.current = 0;
      return;
    }

    const existing = plan.instructions.find((s) => s.step === activeStep)?.imageDataUrl;
    // Already have a real photo for this step and we already captured it this session.
    if (existing?.startsWith("data:image") && existing.length > 800 && last.current === activeStep) {
      return;
    }

    let cancelled = false;
    tries.current = 0;

    function grab() {
      if (cancelled) return;
      tries.current += 1;
      try {
        // Force one more frame so CameraRig + step lighting are on the buffer.
        gl.render(scene, camera);
        // 0.92 quality — sharp enough for full-width PDF plates without huge payloads.
        const dataUrl = gl.domElement.toDataURL("image/jpeg", 0.92);
        if (dataUrl?.startsWith("data:image") && dataUrl.length > 1200) {
          attachStepImage(activeStep!, dataUrl);
          last.current = activeStep!;
          return;
        }
      } catch {
        /* canvas may be tainted or disposed */
      }
      // Retry once after a longer settle (mobile WebGL is slow).
      if (tries.current < 2) {
        window.setTimeout(grab, 700);
      }
    }

    // First attempt after camera + lighting settle.
    const t = window.setTimeout(grab, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [activeStep, plan?.instructions.length, gl, scene, camera, attachStepImage]);

  return null;
}

export function WorkspaceCanvas() {
  const project = useYard((s) => s.project);
  const explode = useYard((s) => s.explode);
  const facesOpen = useYard((s) => s.facesOpen);
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
          toneMappingExposure: 1.08,
        }}
        frameloop="always"
        dpr={[1, 1.75]}
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
        {/* Shop HDRI for real reflections on ply/maple; solid bg stays dark product floor */}
        <Environment preset="warehouse" environmentIntensity={0.88} background={false} />
        <StudioLights project={project} useShadows={useShadows} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[240, 240]} />
          <meshStandardMaterial color="#2a241c" roughness={0.9} metalness={0} />
        </mesh>
        <BenchScene
          project={project}
          explode={explode}
          facesOpen={facesOpen}
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
        <OrbitControls makeDefault enabled={workMode !== "walk"} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={480} target={[0, 6, 0]} />
        <CameraRig project={project} preset={camera} stepIds={stepIds} locked={workMode === "walk"} />
        {workMode === "walk" && project.traverse && <WalkRig traverse={project.traverse} />}
        <StepCapture />
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
    const isFlat = !!project.flat && !project.flat.lifted;
    const eiffel = project.kind === "eiffel";
    const fitted = project.panels.length > 0 && !eiffel && !isFlat;
    const h = Math.max(project.overall.height, isFlat ? 6 : 12);
    const fit = Math.max(h, project.overall.width, project.overall.depth, isFlat ? 8 : 12);
    const dist = eiffel
      ? Math.max(h * 0.62, project.overall.width * 1.15) * 2.05
      : fitted
        ? fit * 1.42
        : fit * (isFlat ? 1.35 : 1.55);
    const focus = focusOf(project, stepIds);
    const fy = isFlat ? Math.max(focus.y, h * 0.35) : eiffel ? h * 0.28 : fitted ? h * 0.42 : focus.y;
    const presets: Record<typeof preset, [number, number, number]> = {
      iso: isFlat
        ? [focus.x + dist * 0.55, fy + dist * 0.75, focus.z + dist * 0.55]
        : eiffel
          ? [focus.x + dist * 0.78, h * 0.16, focus.z + dist * 0.78]
          : fitted
            ? [focus.x + dist * 0.82, h * 0.38, focus.z + dist * 0.92]
            : [focus.x + dist * 0.92, focus.y * 0.55 + 8, focus.z + dist * 0.92],
      front: [focus.x, eiffel ? h * 0.22 : fitted ? h * 0.45 : fy, focus.z + dist * (isFlat ? 1.05 : eiffel ? 1.05 : 1.28)],
      side: [focus.x + dist * (isFlat ? 1.05 : eiffel ? 1.05 : 1.28), eiffel ? h * 0.22 : fitted ? h * 0.45 : fy, focus.z],
      top: [focus.x, fy + fit * (isFlat ? 1.15 : 1.35), focus.z + 0.01],
    };
    const [x, y, z] = presets[preset];
    camera.position.set(x, y, z);
    const tgt = new THREE.Vector3(focus.x, fy, focus.z);
    camera.lookAt(tgt);
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (orbit?.target) {
      orbit.target.copy(tgt);
      orbit.update?.();
    }
  }, [preset, project.id, project.overall, project.instances.length, project.flat, stepIds.join("|"), camera, controls, locked]);
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
    [[-hx, height, -hz], [hx, height, -hz], [hx, height, hz], [-hx, height, -hz], [-hx, height, -hz]],
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
  project, explode, facesOpen, selectedId, onSelect, onPlace, showHull, showHistoric, workMode, stepIds, placedIds, lockedIds, dragPos, measureOpen, measure, pending, detail, joinMethod, useShadows,
}: {
  project: YardProject;
  explode: boolean;
  facesOpen: boolean;
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
  // True 32mm pin holes only when the unit actually has adjustable shelves.
  const showPinHoles = useMemo(
    () => project.panels.some((p) => p.type === "shelf"),
    [project.panels],
  );

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
              facesOpen={facesOpen}
              showPinHoles={showPinHoles}
            />
          ))}
      {!pending && project.panels.length > 0 && (
        <CarcaseJoins panels={project.panels} explode={explodeScale} />
      )}
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
