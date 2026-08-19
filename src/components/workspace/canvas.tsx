"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { getCatalogItem } from "@/lib/yard/catalog";
import { isCylindrical, visualPrimitive } from "@/lib/yard/geometry";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile, historicStrokes, homeOf, hullStrokes } from "@/lib/yard/ghost";
import { pilePosition, stepInstanceIds } from "@/lib/yard/assembly";
import type { Panel, Vec3, WorkMode, YardInstance, YardProject } from "@/lib/yard/types";

const HULL = "#8a8478";
const HIST = "#d7cbb6";
const ROLE_TINT: Record<string, string> = {
  leg: "#e6b45c", brace: "#c99648", ring: "#f0d08a", rail: "#dfc078",
  tip: "#f4e2b0", splice: "#d4a85a", support: "#c4b49a", base: "#e0b86a",
};

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
  const step = plan?.instructions.find((s) => s.step === activeStep) ?? null;
  const stepIds = useMemo(() => (step ? stepInstanceIds(project, step) : []), [step, project]);

  return (
    <div className="absolute inset-0">
      <Canvas
        key={project.id}
        camera={{ position: [48, 32, 48], fov: 34, near: 0.1, far: 4000 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        dpr={[1, 1.5]}
        style={{ display: "block", width: "100%", height: "100%" }}
        onCreated={({ camera: cam, gl, scene }) => {
          gl.setClearColor("#161310", 1);
          scene.background = new THREE.Color("#161310");
          cam.lookAt(0, 14, 0);
        }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={["#161310"]} />
        <ambientLight intensity={1.6} />
        <hemisphereLight args={["#fff3e0", "#3a3228", 1]} />
        <directionalLight position={[40, 70, 30]} intensity={1.2} />
        <BenchScene
          project={project} explode={explode} selectedId={selectedId} onSelect={select} onPlace={placePiece}
          showHull={showHull} showHistoric={showHistoric && (hasHistoricProfile(project.kind) || !!project.historic)}
          workMode={workMode} stepIds={stepIds} placedIds={placedIds} lockedIds={lockedIds} dragPos={dragPos}
          measureOpen={measureOpen} measure={measure}
        />
        <Grid args={[80, 80]} cellSize={8} cellThickness={0.28} cellColor="#1a1612" sectionSize={24} sectionThickness={0.5} sectionColor="#2a241e" fadeDistance={80} fadeStrength={2.2} infiniteGrid position={[0, 0, 0]} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={6} maxDistance={480} target={[0, 14, 0]} />
        <CameraRig project={project} preset={camera} />
      </Canvas>
    </div>
  );
}

function focusOf(project: YardProject) {
  if (project.instances.length) {
    let x = 0, y = 0, z = 0;
    for (const i of project.instances) { const p = homeOf(i); x += p.x; y += p.y; z += p.z; }
    const n = project.instances.length;
    return { x: x / n, y: y / n, z: z / n };
  }
  if (project.panels.length) {
    let x = 0, y = 0, z = 0;
    for (const p of project.panels) { x += p.position.x + p.size.width / 2; y += p.position.y + p.size.height / 2; z += p.position.z + p.size.depth / 2; }
    const n = project.panels.length;
    return { x: x / n, y: y / n, z: z / n };
  }
  return { x: 0, y: Math.max(project.overall.height, 12) * 0.4, z: 0 };
}

function CameraRig({ project, preset }: { project: YardProject; preset: "iso" | "front" | "side" | "top" }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const h = Math.max(project.overall.height, 12);
    const span = Math.max(project.overall.width, project.overall.depth, 12);
    const fit = Math.max(h, span);
    const dist = fit * (project.pocket ? 1.85 : project.windowPkg ? 1.7 : 1.55);
    const focus = focusOf(project);
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
    if (orbit?.target) { orbit.target.copy(tgt); orbit.update?.(); }
  }, [preset, project.id, project.overall, project.instances.length, project.panels.length, camera, controls]);
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

function BenchScene({
  project, explode, selectedId, onSelect, onPlace, showHull, showHistoric, workMode, stepIds, placedIds, lockedIds, dragPos, measureOpen, measure,
}: {
  project: YardProject; explode: boolean; selectedId: string | null; onSelect: (id: string | null) => void; onPlace: (catalogId: string, pos: Vec3) => void;
  showHull: boolean; showHistoric: boolean; workMode: WorkMode; stepIds: string[]; placedIds: string[]; lockedIds: string[];
  dragPos: { id: string; pos: Vec3 } | null; measureOpen: boolean; measure: { width: string; height: string; depth: string };
}) {
  const explodeScale = explode ? 1.35 : 1;
  const hull = useMemo(() => (showHull ? hullStrokes(project) : []), [showHull, project]);
  const historic = useMemo(() => (showHistoric ? historicStrokes(project) : []), [showHistoric, project]);
  const mw = parseFloat(measure.width) || 0;
  const mh = parseFloat(measure.height) || 0;
  const md = parseFloat(measure.depth) || 0;
  return (
    <group>
      {showHull && <GhostLines strokes={hull} color={HULL} />}
      {showHistoric && <GhostLines strokes={historic} color={HIST} />}
      {measureOpen && mw > 0 && mh > 0 && (
        <group>
          {([[-mw / 2, 0, -md / 2], [mw / 2, 0, -md / 2], [mw / 2, 0, md / 2], [-mw / 2, 0, md / 2], [-mw / 2, 0, -md / 2]] as [number, number, number][]).length && (
            <Line points={[[-mw / 2, 0, -md / 2], [mw / 2, 0, -md / 2], [mw / 2, 0, md / 2], [-mw / 2, 0, md / 2], [-mw / 2, 0, -md / 2]]} color="#c4b49a" lineWidth={1.2} transparent opacity={0.7} depthWrite={false} />
          )}
          <Line points={[[-mw / 2, mh, -md / 2], [mw / 2, mh, -md / 2], [mw / 2, mh, md / 2], [-mw / 2, mh, md / 2], [-mw / 2, mh, -md / 2]]} color="#c4b49a" lineWidth={1.2} transparent opacity={0.7} depthWrite={false} />
        </group>
      )}
      <StickCloud instances={project.instances} explode={explodeScale} selectedId={selectedId} workMode={workMode} stepIds={stepIds} placedIds={placedIds} lockedIds={lockedIds} dragPos={dragPos} overall={project.overall} onSelect={onSelect} />
      {project.panels.map((panel) => (
        <PanelMesh key={panel.id} panel={panel} explode={explodeScale} selected={panel.id === selectedId} inStep={stepIds.length ? stepIds.includes(panel.id) : false} hasStep={stepIds.length > 0} onSelect={() => onSelect(panel.id)} />
      ))}
      {workMode === "free" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onPointerDown={(e) => {
          if (e.delta > 2) return;
          e.stopPropagation();
          onPlace(project.primaryMaterialId, { x: Math.round(e.point.x * 4) / 4, y: 0, z: Math.round(e.point.z * 4) / 4 });
        }}>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}

function displayPos(inst: YardInstance, index: number, count: number, overall: { width: number; depth: number }, workMode: WorkMode, placed: boolean, drag: Vec3 | null): Vec3 {
  if (drag) return drag;
  if (workMode === "build" && !placed) return pilePosition(index, count, overall);
  return inst.position;
}

function StickCloud({
  instances, explode, selectedId, workMode, stepIds, placedIds, lockedIds, dragPos, overall, onSelect,
}: {
  instances: YardInstance[]; explode: number; selectedId: string | null; workMode: WorkMode;
  stepIds: string[]; placedIds: string[]; lockedIds: string[]; dragPos: { id: string; pos: Vec3 } | null;
  overall: { width: number; height: number; depth: number }; onSelect: (id: string | null) => void;
}) {
  const setDrag = useYard((s) => s.setDragPos);
  const movePiece = useYard((s) => s.movePiece);
  return (
    <group>
      {instances.map((inst, index) => {
        const item = getCatalogItem(inst.catalogId);
        if (!item) return null;
        const prim = visualPrimitive(item, inst.cutLength);
        const placed = workMode !== "build" || placedIds.includes(inst.id);
        const pos = displayPos(inst, index, instances.length, overall, workMode, placed, dragPos?.id === inst.id ? dragPos.pos : null);
        const cyl = isCylindrical(item.formFactor);
        const tint = ROLE_TINT[inst.role ?? ""] ?? item.color ?? "#d4b896";
        const selected = inst.id === selectedId;
        const dim = stepIds.length > 0 && !stepIds.includes(inst.id);
        return (
          <mesh
            key={inst.id}
            position={[pos.x * explode, pos.y * explode, pos.z * explode]}
            rotation={[inst.rotation.x, inst.rotation.y, inst.rotation.z]}
            onClick={(e) => { e.stopPropagation(); onSelect(inst.id); }}
            onPointerDown={(e) => {
              if (workMode === "look" || lockedIds.includes(inst.id)) return;
              e.stopPropagation();
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1 || workMode === "look" || lockedIds.includes(inst.id)) return;
              setDrag({ id: inst.id, pos: { x: e.point.x, y: Math.max(0, e.point.y), z: e.point.z } });
            }}
            onPointerUp={() => {
              if (dragPos?.id === inst.id) { movePiece(inst.id, dragPos.pos); setDrag(null); }
            }}
          >
            {cyl ? <cylinderGeometry args={[(prim.radius ?? prim.width / 2), prim.radius ?? prim.width / 2, prim.length, 8]} /> : <boxGeometry args={[prim.width, prim.height, prim.length]} />}
            <meshStandardMaterial color={selected ? "#fff4d6" : tint} roughness={item.roughness ?? 0.7} metalness={item.metalness ?? 0} transparent={dim} opacity={dim ? 0.28 : 1} />
          </mesh>
        );
      })}
    </group>
  );
}

function PanelMesh({ panel, explode, selected, inStep, hasStep, onSelect }: { panel: Panel; explode: number; selected: boolean; inStep: boolean; hasStep: boolean; onSelect: () => void }) {
  const { x, y, z } = panel.position;
  const { width: w, height: h, depth: d } = panel.size;
  const dim = hasStep && !inStep;
  const color = panel.type === "mirror" || panel.type === "glass_panel" ? "#9ec5d6" : selected ? "#fff4d6" : "#d4b896";
  return (
    <mesh position={[(x + w / 2) * explode, (y + h / 2) * explode, (z + d / 2) * explode]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <boxGeometry args={[Math.max(w, 0.08), Math.max(h, 0.08), Math.max(d, 0.08)]} />
      <meshStandardMaterial color={color} roughness={0.65} transparent={dim || panel.type === "mirror"} opacity={dim ? 0.22 : panel.type === "mirror" ? 0.45 : 1} />
    </mesh>
  );
}
