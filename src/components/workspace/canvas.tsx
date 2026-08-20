"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { getCatalogItem } from "@/lib/yard/catalog";
import { isCylindrical, readableDiameter, visualPrimitive } from "@/lib/yard/geometry";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile, historicStrokes, homeOf, hullStrokes } from "@/lib/yard/ghost";
import { pilePosition, stepInstanceIds } from "@/lib/yard/assembly";
import type { Panel, Vec3, WorkMode, YardInstance, YardProject } from "@/lib/yard/types";
import type { PrimitiveDims } from "@/lib/yard/geometry";

const HULL = "#8a8478";
const HIST = "#d7cbb6";
const SLOT = "#f2ebe1";

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
  const pending = building || grokBusy;

  const step = plan?.instructions.find((s) => s.step === activeStep) ?? null;
  const stepIds = useMemo(
    () => (step ? stepInstanceIds(project, step) : []),
    [step, project],
  );

  return (
    <div className="absolute inset-0">
      <Canvas
        key={project.id}
        camera={{ position: [48, 32, 48], fov: 34, near: 0.1, far: 4000 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "default", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}
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
        <ambientLight intensity={0.42} />
        <hemisphereLight args={["#ffe8c8", "#2a241c", 0.7]} />
        <directionalLight position={[36, 64, 28]} intensity={1.55} color="#fff4e4" />
        <directionalLight position={[-28, 22, -18]} intensity={0.35} color="#9bb4d4" />
        <ContactShadows position={[0, 0.02, 0]} opacity={0.42} scale={90} blur={2.4} far={50} color="#0c0a08" />
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
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={480}
          target={[0, 14, 0]}
        />
        <CameraRig project={project} preset={camera} stepIds={stepIds} />
      </Canvas>
    </div>
  );
}

function focusOf(project: YardProject, stepIds?: string[]): { x: number; y: number; z: number } {
  const hot = new Set(stepIds ?? []);
  if (project.instances.length) {
    const list = hot.size
      ? project.instances.filter((i) => hot.has(i.id))
      : project.instances;
    const use = list.length ? list : project.instances;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const i of use) {
      const p = homeOf(i);
      x += p.x;
      y += p.y;
      z += p.z;
    }
    const n = use.length;
    return { x: x / n, y: y / n, z: z / n };
  }
  if (project.panels.length) {
    const list = hot.size ? project.panels.filter((p) => hot.has(p.id)) : project.panels;
    const use = list.length ? list : project.panels;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const p of use) {
      x += p.position.x + p.size.width / 2;
      y += p.position.y + p.size.height / 2;
      z += p.position.z + p.size.depth / 2;
    }
    const n = use.length;
    return { x: x / n, y: y / n, z: z / n };
  }
  return { x: 0, y: Math.max(project.overall.height, 12) * 0.4, z: 0 };
}

function CameraRig({
  project,
  preset,
  stepIds,
}: {
  project: YardProject;
  preset: "iso" | "front" | "side" | "top";
  stepIds: string[];
}) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const h = Math.max(project.overall.height, 12);
    const span = Math.max(project.overall.width, project.overall.depth, 12);
    const fit = Math.max(h, span);
    const dist = fit * (project.pocket ? 1.85 : project.windowPkg ? 1.7 : 1.55);
    const focus = focusOf(project, stepIds);
    const presets: Record<typeof preset, [number, number, number]> = project.pocket
      ? {
          iso: [focus.x + dist * 0.45, focus.y * 0.28 + 10, focus.z + dist * 1.05],
          front: [focus.x, focus.y * 0.45, focus.z + dist * 1.35],
          side: [focus.x + dist * 1.15, focus.y * 0.4, focus.z + dist * 0.2],
          top: [focus.x, focus.y + fit * 1.2, focus.z + span * 0.15],
        }
      : project.windowPkg
        ? {
            iso: [focus.x + dist * 0.35, focus.y * 0.2 + 8, focus.z + dist * 1.15],
            front: [focus.x, focus.y * 0.4, focus.z + dist * 1.25],
            side: [focus.x + dist * 1.2, focus.y * 0.4, focus.z + 8],
            top: [focus.x, focus.y + fit * 1.15, focus.z + 4],
          }
        : {
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
  }, [preset, project.id, project.overall.height, project.overall.width, project.overall.depth, project.instances.length, project.panels.length, stepIds.join("|"), camera, controls]);

  return null;
}

function GhostLines({ strokes, color }: { strokes: ReturnType<typeof hullStrokes>; color: string }) {
  return (
    <group>
      {strokes.map((s, i) => (
        <Line
          key={`${color}-${i}`}
          points={s.points}
          color={color}
          lineWidth={s.weight === "main" ? 1.4 : 0.8}
          transparent
          opacity={s.weight === "main" ? 0.55 : 0.32}
          depthWrite={false}
        />
      ))}
    </group>
  );
}

function MeasureGhost({
  width,
  height,
  depth,
}: {
  width: number;
  height: number;
  depth: number;
}) {
  const hx = width / 2;
  const hz = depth / 2;
  const pts: [number, number, number][][] = [
    [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-hx, 0, -hz]],
    [[-hx, height, -hz], [hx, height, -hz], [hx, height, hz], [-hx, height, hz], [-hx, height, -hz]],
    [[-hx, 0, -hz], [-hx, height, -hz]],
    [[hx, 0, -hz], [hx, height, -hz]],
    [[hx, 0, hz], [hx, height, hz]],
    [[-hx, 0, hz], [-hx, height, hz]],
    [[-hx, 0, 0], [hx, 0, 0]],
    [[-hx, 0, -hz], [-hx, 0, hz]],
    [[-hx, 0, -hz], [-hx, height, -hz]],
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
  project,
  explode,
  selectedId,
  onSelect,
  onPlace,
  showHull,
  showHistoric,
  workMode,
  stepIds,
  placedIds,
  lockedIds,
  dragPos,
  measureOpen,
  measure,
  pending,
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
}) {
  const explodeScale = explode ? 1.35 : 1;
  const hull = useMemo(() => (showHull ? hullStrokes(project) : []), [showHull, project]);
  const historic = useMemo(
    () => (showHistoric ? historicStrokes(project) : []),
    [showHistoric, project],
  );
  const mw = parseFloat(measure.width) || 0;
  const mh = parseFloat(measure.height) || 0;
  const md = parseFloat(measure.depth) || 0;

  return (
    <group>
      {showHull && <GhostLines strokes={hull} color={HULL} />}
      {showHistoric && <GhostLines strokes={historic} color={HIST} />}
      {measureOpen && mw > 0 && mh > 0 && <MeasureGhost width={mw} height={mh} depth={md || 16} />}
      {!pending && (
        <StickCloud
          instances={project.instances}
          explode={explodeScale}
          selectedId={selectedId}
          workMode={workMode}
          stepIds={stepIds}
          placedIds={placedIds}
          lockedIds={lockedIds}
          dragPos={dragPos}
          overall={project.overall}
          onSelect={onSelect}
        />
      )}
      {!pending &&
        project.panels.map((panel) => (
        <PanelMesh
          key={panel.id}
          panel={panel}
          explode={explodeScale}
          selected={panel.id === selectedId}
          inStep={stepIds.length ? stepIds.includes(panel.id) : false}
          hasStep={stepIds.length > 0}
          onSelect={() => onSelect(panel.id)}
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

const ROLE_TINT: Record<string, string> = {
  leg: "#e6b45c",
  brace: "#c99648",
  ring: "#f0d08a",
  rail: "#dfc078",
  tip: "#f4e2b0",
  splice: "#d4a85a",
  support: "#c4b49a",
  base: "#e0b86a",
};

const _dir = new THREE.Vector3();
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _flip = new THREE.Vector3(0, 0, 1);

const FIT_CREAM = "#fffaf0";
const FIT_RIVET = "#c4a06a";

function spanOf(overall: { width: number; height: number; depth: number }) {
  return Math.max(overall.width, overall.height, overall.depth, 12);
}

function meshDiameter(prim: PrimitiveDims, cylindrical: boolean, overall: { width: number; height: number; depth: number }) {
  const trueD = cylindrical ? Math.max(prim.radius ?? 0.2, 0.12) * 2 : Math.max(prim.width, prim.height, 0.2);
  return readableDiameter(trueD, spanOf(overall), cylindrical);
}

function applyMemberPose(
  dummy: THREE.Object3D,
  inst: YardInstance,
  prim: PrimitiveDims,
  cylindrical: boolean,
  explode: number,
  fallback: Vec3,
  rot: Vec3,
  overall: { width: number; height: number; depth: number },
) {
  const from = inst.from;
  const to = inst.to;
  const diameter = meshDiameter(prim, cylindrical, overall);
  // Cylinders seat inside the fitting hub; boxes lap by about half their thickness.
  const pad = cylindrical ? Math.min(diameter * 0.28, 1.35) : Math.min(diameter * 0.55, 2.2);

  if (from && to) {
    _dir.set(to.x - from.x, to.y - from.y, to.z - from.z);
    const span = _dir.length() || 0.01;
    _dir.multiplyScalar(1 / span);
    dummy.position.set(((from.x + to.x) / 2) * explode, (from.y + to.y) / 2, ((from.z + to.z) / 2) * explode);
    const axis = cylindrical ? _axisY : _axisX;
    const dot = axis.dot(_dir);
    if (dot < -0.999) dummy.quaternion.setFromAxisAngle(_flip, Math.PI);
    else dummy.quaternion.setFromUnitVectors(axis, _dir);
    const length = span + pad * 2;
    if (cylindrical) dummy.scale.set(diameter, length, diameter);
    else dummy.scale.set(length, prim.height, prim.width);
    return;
  }

  dummy.position.set(fallback.x * explode, fallback.y, fallback.z * explode);
  dummy.quaternion.setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z));
  if (cylindrical) dummy.scale.set(diameter, prim.length, diameter);
  else dummy.scale.set(prim.length, prim.height, prim.width);
}

function displayPos(
  inst: YardInstance,
  index: number,
  count: number,
  overall: { width: number; depth: number },
  workMode: WorkMode,
  placed: boolean,
  drag: Vec3 | null,
): Vec3 {
  if (drag) return drag;
  if (workMode === "build" && !placed) return pilePosition(index, count, overall);
  return inst.position;
}

function StickCloud({
  instances,
  explode,
  selectedId,
  workMode,
  stepIds,
  placedIds,
  lockedIds,
  dragPos,
  overall,
  onSelect,
}: {
  instances: YardInstance[];
  explode: number;
  selectedId: string | null;
  workMode: WorkMode;
  stepIds: string[];
  placedIds: string[];
  lockedIds: string[];
  dragPos: { id: string; pos: Vec3 } | null;
  overall: { width: number; height: number; depth: number };
  onSelect: (id: string | null) => void;
}) {
  const boxes = useMemo(() => {
    return instances
      .map((inst, index) => {
        const item = getCatalogItem(inst.catalogId);
        if (!item || isCylindrical(item.formFactor)) return null;
        const prim = visualPrimitive(item, inst.cutLength);
        return { inst, index, item, prim, cyl: false as const };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [instances]);

  const cyls = useMemo(() => {
    return instances
      .map((inst, index) => {
        const item = getCatalogItem(inst.catalogId);
        if (!item || !isCylindrical(item.formFactor)) return null;
        const prim = visualPrimitive(item, inst.cutLength);
        return { inst, index, item, prim, cyl: true as const };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [instances]);

  const dragInst = dragPos ? instances.find((i) => i.id === dragPos.id) : null;
  const dragIndex = dragInst ? instances.indexOf(dragInst) : -1;

  return (
    <group>
      <CloudKind
        rows={boxes}
        explode={explode}
        selectedId={selectedId}
        workMode={workMode}
        stepIds={stepIds}
        placedIds={placedIds}
        lockedIds={lockedIds}
        dragId={dragPos?.id ?? null}
        overall={overall}
        count={instances.length}
        onSelect={onSelect}
        cylindrical={false}
      />
      <CloudKind
        rows={cyls}
        explode={explode}
        selectedId={selectedId}
        workMode={workMode}
        stepIds={stepIds}
        placedIds={placedIds}
        lockedIds={lockedIds}
        dragId={dragPos?.id ?? null}
        overall={overall}
        count={instances.length}
        onSelect={onSelect}
        cylindrical={true}
      />
      {workMode !== "build" && <FittingCloud cyls={cyls} boxes={boxes} explode={explode} overall={overall} />}
      {dragInst && dragPos && (
        <InstanceMesh
          instance={dragInst}
          index={Math.max(0, dragIndex)}
          count={instances.length}
          overall={overall}
          explode={explode}
          selected
          workMode={workMode}
          inStep={stepIds.includes(dragInst.id)}
          hasStep={stepIds.length > 0}
          placed={placedIds.includes(dragInst.id)}
          locked={false}
          dragPos={dragPos.pos}
          onSelect={() => onSelect(dragInst.id)}
        />
      )}
    </group>
  );
}

function CloudKind({
  rows,
  explode,
  selectedId,
  workMode,
  stepIds,
  placedIds,
  lockedIds,
  dragId,
  overall,
  count,
  onSelect,
  cylindrical,
}: {
  rows: {
    inst: YardInstance;
    index: number;
    item: NonNullable<ReturnType<typeof getCatalogItem>>;
    prim: ReturnType<typeof visualPrimitive>;
    cyl: boolean;
  }[];
  explode: number;
  selectedId: string | null;
  workMode: WorkMode;
  stepIds: string[];
  placedIds: string[];
  lockedIds: string[];
  dragId: string | null;
  overall: { width: number; height: number; depth: number };
  count: number;
  onSelect: (id: string | null) => void;
  cylindrical: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { controls } = useThree();
  const nudge = useYard((s) => s.nudgeInstance);
  const finish = useYard((s) => s.finishMove);
  const dragging = useRef<number | null>(null);
  const start = useRef({ mouse: new THREE.Vector3(), pos: { x: 0, y: 0, z: 0 } });
  const live = rows.filter((r) => r.inst.id !== dragId);
  const hasStep = stepIds.length > 0;

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < live.length; i++) {
      const { inst, index, prim } = live[i];
      const placed = placedIds.includes(inst.id);
      const pos = displayPos(inst, index, count, overall, workMode, placed, null);
      const piled = workMode === "build" && !placed;
      if (piled) {
        dummy.position.set(pos.x * explode, pos.y, pos.z * explode);
        dummy.quaternion.identity();
        const diameter = meshDiameter(prim, cylindrical, overall);
        if (cylindrical) dummy.scale.set(diameter, prim.length, diameter);
        else dummy.scale.set(prim.length, prim.height, prim.width);
      } else {
        applyMemberPose(dummy, inst, prim, cylindrical, explode, pos, inst.rotation, overall);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const inStep = hasStep && stepIds.includes(inst.id);
      const selected = inst.id === selectedId;
      const stock = live[i].item.color || ROLE_TINT[inst.role ?? ""] || "#e0b86a";
      const hex = selected || inStep ? "#fff1d0" : stock;
      color.set(hasStep && !inStep ? "#5c5348" : hex);
      m.setColorAt(i, color);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.count = live.length;
  }, [live, explode, workMode, placedIds, stepIds, selectedId, hasStep, count, overall, cylindrical]);

  const setOrbit = (on: boolean) => {
    const orbit = controls as unknown as { enabled?: boolean } | null;
    if (orbit && "enabled" in orbit) orbit.enabled = on;
  };

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const idx = e.instanceId;
    if (idx == null || !live[idx]) return;
    const { inst, index } = live[idx];
    onSelect(inst.id);
    const locked = workMode === "look" || (workMode === "free" && lockedIds.includes(inst.id)) || (workMode === "build" && placedIds.includes(inst.id));
    if (locked) return;
    dragging.current = idx;
    const placed = placedIds.includes(inst.id);
    const pos = displayPos(inst, index, count, overall, workMode, placed, null);
    start.current = { mouse: e.point.clone(), pos: { ...pos } };
    setOrbit(false);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (dragging.current == null) return;
    e.stopPropagation();
    const row = live[dragging.current];
    if (!row) return;
    const delta = e.point.clone().sub(start.current.mouse);
    const next = { ...start.current.pos };
    if (e.nativeEvent.shiftKey) {
      next.y = Math.max(0.1, Math.round((start.current.pos.y + delta.y) * 4) / 4);
    } else {
      next.x = Math.round((start.current.pos.x + delta.x) * 4) / 4;
      next.z = Math.round((start.current.pos.z + delta.z) * 4) / 4;
    }
    nudge(row.inst.id, next);
  };
  const up = () => {
    if (dragging.current == null) return;
    const row = live[dragging.current];
    dragging.current = null;
    setOrbit(true);
    if (!row) return;
    const current = useYard.getState().dragPos;
    finish(row.inst.id, current?.id === row.inst.id ? current.pos : start.current.pos);
  };

  if (!live.length) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, Math.max(live.length, 1)]}
      frustumCulled={false}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {cylindrical ? <cylinderGeometry args={[0.5, 0.5, 1, 14]} /> : <boxGeometry args={[1, 1, 1]} />}
      <meshStandardMaterial roughness={0.68} metalness={0.04} />
    </instancedMesh>
  );
}

function FittingCloud({
  cyls,
  boxes,
  explode,
  overall,
}: {
  cyls: {
    inst: YardInstance;
    prim: ReturnType<typeof visualPrimitive>;
    item: NonNullable<ReturnType<typeof getCatalogItem>>;
  }[];
  boxes: {
    inst: YardInstance;
    prim: ReturnType<typeof visualPrimitive>;
    item: NonNullable<ReturnType<typeof getCatalogItem>>;
  }[];
  explode: number;
  overall: { width: number; height: number; depth: number };
}) {
  const hubMesh = useRef<THREE.InstancedMesh>(null);
  const sockMesh = useRef<THREE.InstancedMesh>(null);
  const rivetMesh = useRef<THREE.InstancedMesh>(null);

  const { hubs, sockets, rivets } = useMemo(() => {
    type Node = { p: Vec3; r: number; dirs: THREE.Vector3[] };
    const pipeNodes = new Map<string, Node>();
    const keyOf = (p: Vec3) => `${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.z.toFixed(2)}`;

    for (const row of cyls) {
      const from = row.inst.from;
      const to = row.inst.to;
      if (!from || !to) continue;
      const r = meshDiameter(row.prim, true, overall) / 2;
      const ends: [Vec3, Vec3][] = [
        [from, to],
        [to, from],
      ];
      for (const [at, other] of ends) {
        const k = keyOf(at);
        let node = pipeNodes.get(k);
        if (!node) {
          node = { p: at, r, dirs: [] };
          pipeNodes.set(k, node);
        } else if (r > node.r) node.r = r;
        const dir = new THREE.Vector3(other.x - at.x, other.y - at.y, other.z - at.z).normalize();
        if (!node.dirs.some((d) => d.dot(dir) > 0.97)) node.dirs.push(dir);
      }
    }

    const hubs: { p: Vec3; r: number }[] = [];
    const sockets: { p: Vec3; dir: THREE.Vector3; r: number; length: number }[] = [];
    for (const node of pipeNodes.values()) {
      const dirs = node.dirs;
      const valence = dirs.length;
      const r = node.r;
      const shallow =
        valence === 2 && dirs[0].dot(dirs[1]) < -0.62;
      const groundCap = valence === 1 && node.p.y < 0.45;
      if (shallow || groundCap) continue;
      if (valence === 1) {
        hubs.push({ p: node.p, r: r * 1.18 });
        continue;
      }
      hubs.push({ p: node.p, r: r * 1.52 });
      const len = r * 2.05;
      for (const d of dirs) {
        sockets.push({
          p: {
            x: node.p.x + d.x * len * 0.36,
            y: node.p.y + d.y * len * 0.36,
            z: node.p.z + d.z * len * 0.36,
          },
          dir: d,
          r: r * 1.24,
          length: len,
        });
      }
    }

    const rivetMap = new Map<string, { p: Vec3; r: number }>();
    for (const row of boxes) {
      const r = meshDiameter(row.prim, false, overall) * 0.62;
      for (const p of [row.inst.from, row.inst.to]) {
        if (!p) continue;
        const k = keyOf(p);
        const prev = rivetMap.get(k);
        if (!prev || r > prev.r) rivetMap.set(k, { p, r: Math.max(r, 0.12) });
      }
    }

    return { hubs, sockets, rivets: [...rivetMap.values()] };
  }, [cyls, boxes, overall]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hubsM = hubMesh.current;
    if (hubsM) {
      color.set(FIT_CREAM);
      for (let i = 0; i < hubs.length; i++) {
        const n = hubs[i];
        dummy.position.set(n.p.x * explode, n.p.y, n.p.z * explode);
        dummy.quaternion.identity();
        dummy.scale.setScalar(n.r);
        dummy.updateMatrix();
        hubsM.setMatrixAt(i, dummy.matrix);
        hubsM.setColorAt(i, color);
      }
      hubsM.instanceMatrix.needsUpdate = true;
      if (hubsM.instanceColor) hubsM.instanceColor.needsUpdate = true;
      hubsM.count = hubs.length;
    }
    const socksM = sockMesh.current;
    if (socksM) {
      color.set(FIT_CREAM);
      for (let i = 0; i < sockets.length; i++) {
        const s = sockets[i];
        dummy.position.set(s.p.x * explode, s.p.y, s.p.z * explode);
        const dot = _axisY.dot(s.dir);
        if (dot < -0.999) dummy.quaternion.setFromAxisAngle(_flip, Math.PI);
        else dummy.quaternion.setFromUnitVectors(_axisY, s.dir);
        dummy.scale.set(s.r * 2, s.length, s.r * 2);
        dummy.updateMatrix();
        socksM.setMatrixAt(i, dummy.matrix);
        socksM.setColorAt(i, color);
      }
      socksM.instanceMatrix.needsUpdate = true;
      if (socksM.instanceColor) socksM.instanceColor.needsUpdate = true;
      socksM.count = sockets.length;
    }
    const rivM = rivetMesh.current;
    if (rivM) {
      color.set(FIT_RIVET);
      for (let i = 0; i < rivets.length; i++) {
        const n = rivets[i];
        dummy.position.set(n.p.x * explode, n.p.y, n.p.z * explode);
        dummy.quaternion.identity();
        dummy.scale.setScalar(n.r);
        dummy.updateMatrix();
        rivM.setMatrixAt(i, dummy.matrix);
        rivM.setColorAt(i, color);
      }
      rivM.instanceMatrix.needsUpdate = true;
      if (rivM.instanceColor) rivM.instanceColor.needsUpdate = true;
      rivM.count = rivets.length;
    }
  }, [hubs, sockets, rivets, explode]);

  return (
    <group>
      {hubs.length > 0 && (
        <instancedMesh ref={hubMesh} args={[undefined, undefined, Math.max(hubs.length, 1)]} frustumCulled={false}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={FIT_CREAM} roughness={0.38} metalness={0.08} />
        </instancedMesh>
      )}
      {sockets.length > 0 && (
        <instancedMesh ref={sockMesh} args={[undefined, undefined, Math.max(sockets.length, 1)]} frustumCulled={false}>
          <cylinderGeometry args={[0.5, 0.5, 1, 14]} />
          <meshStandardMaterial color={FIT_CREAM} roughness={0.38} metalness={0.08} />
        </instancedMesh>
      )}
      {rivets.length > 0 && (
        <instancedMesh ref={rivetMesh} args={[undefined, undefined, Math.max(rivets.length, 1)]} frustumCulled={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={FIT_RIVET} roughness={0.55} metalness={0.04} />
        </instancedMesh>
      )}
    </group>
  );
}

function InstanceMesh({
  instance,
  index,
  count,
  overall,
  explode,
  selected,
  workMode,
  inStep,
  hasStep,
  placed,
  locked,
  dragPos,
  onSelect,
}: {
  instance: YardInstance;
  index: number;
  count: number;
  overall: { width: number; height: number; depth: number };
  explode: number;
  selected: boolean;
  workMode: WorkMode;
  inStep: boolean;
  hasStep: boolean;
  placed: boolean;
  locked: boolean;
  dragPos: Vec3 | null;
  onSelect: () => void;
}) {
  const item = getCatalogItem(instance.catalogId);
  const dragging = useRef(false);
  const start = useRef({ mouse: new THREE.Vector3(), pos: { x: 0, y: 0, z: 0 } });
  const { controls } = useThree();
  const nudge = useYard((s) => s.nudgeInstance);
  const finish = useYard((s) => s.finishMove);
  const prim = useMemo(
    () => (item ? visualPrimitive(item, instance.cutLength) : null),
    [item, instance.cutLength],
  );
  if (!item || !prim) return null;

  const home = homeOf(instance);
  const inBuild = workMode === "build";
  const basePos =
    dragPos ??
    (inBuild && !placed ? pilePosition(index, count, overall) : instance.position);
  const canDrag = workMode !== "look" && !(workMode === "free" && locked) && !(inBuild && placed);

  const role = instance.role ?? "";
  let color = selected ? "#fff6e6" : item.color || ROLE_TINT[role] || "#e0b86a";
  if (hasStep && inStep) color = "#fff1d0";
  const opacity = hasStep && !inStep ? 0.22 : 1;

  const cylindrical = isCylindrical(item.formFactor);
  const dummy = new THREE.Object3D();
  const piled = inBuild && !placed && !dragPos;
  if (piled) {
    dummy.position.set(basePos.x * explode, basePos.y, basePos.z * explode);
    dummy.quaternion.identity();
    const diameter = meshDiameter(prim, cylindrical, overall);
    if (cylindrical) dummy.scale.set(diameter, prim.length, diameter);
    else dummy.scale.set(prim.length, prim.height, prim.width);
  } else {
    applyMemberPose(dummy, instance, prim, cylindrical, explode, basePos, instance.rotation, overall);
  }

  const setOrbit = (on: boolean) => {
    const orbit = controls as unknown as { enabled?: boolean } | null;
    if (orbit && "enabled" in orbit) orbit.enabled = on;
  };

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    if (!canDrag) return;
    dragging.current = true;
    start.current = { mouse: e.point.clone(), pos: { ...basePos } };
    setOrbit(false);
    (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      e.pointerId,
    );
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const delta = e.point.clone().sub(start.current.mouse);
    const next = { ...start.current.pos };
    if (e.nativeEvent.shiftKey) {
      next.y = Math.max(0.1, Math.round((start.current.pos.y + delta.y) * 4) / 4);
    } else {
      next.x = Math.round((start.current.pos.x + delta.x) * 4) / 4;
      next.z = Math.round((start.current.pos.z + delta.z) * 4) / 4;
    }
    nudge(instance.id, next);
  };
  const up = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setOrbit(true);
    const current = useYard.getState().dragPos;
    finish(instance.id, current?.id === instance.id ? current.pos : basePos);
  };

  const meshGeom = cylindrical ? <cylinderGeometry args={[0.5, 0.5, 1, 16]} /> : <boxGeometry args={[1, 1, 1]} />;
  const slotGeom = cylindrical ? <cylinderGeometry args={[0.5, 0.5, 1, 16]} /> : <boxGeometry args={[1, 1, 1]} />;

  const slotDummy = new THREE.Object3D();
  applyMemberPose(slotDummy, instance, prim, cylindrical, explode, home, instance.rotation, overall);

  return (
    <group>
      {inBuild && !placed && inStep && (
        <group position={slotDummy.position} quaternion={slotDummy.quaternion} scale={slotDummy.scale}>
          <mesh frustumCulled={false}>
            {slotGeom}
          <meshStandardMaterial color={SLOT} transparent opacity={0.18} depthWrite={false} roughness={1} />
          </mesh>
        </group>
      )}
      <group
        position={dummy.position}
        quaternion={dummy.quaternion}
        scale={dummy.scale}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <mesh frustumCulled={false}>
          {meshGeom}
          <meshStandardMaterial
            color={color}
            transparent={opacity < 1}
            opacity={opacity}
            roughness={0.68}
            metalness={0.04}
          />
        </mesh>
      </group>
    </group>
  );
}

function PanelMesh({
  panel,
  explode,
  selected,
  inStep,
  hasStep,
  onSelect,
}: {
  panel: Panel;
  explode: number;
  selected: boolean;
  inStep: boolean;
  hasStep: boolean;
  onSelect: () => void;
}) {
  const item = getCatalogItem(panel.materialId);
  const cx = panel.position.x + panel.size.width / 2;
  const cy = panel.position.y + panel.size.height / 2;
  const cz = panel.position.z + panel.size.depth / 2;
  const glass = panel.type === "glass_panel" || panel.type === "mirror";
  const opacity = hasStep && !inStep ? 0.2 : glass ? 0.4 : panel.type === "door" ? 0.72 : 1;
  const byType: Record<string, string> = {
    counter: "#e6d3b0",
    drawer: "#c9a56a",
    kick: "#7a6a54",
    mirror: "#b9d4e4",
    door: "#b08948",
    back: "#8e806c",
    rail: "#d8c4a0",
    divider: "#c4a06a",
    upright: "#c4a06a",
    shelf: "#d2b07a",
  };
  const color = selected || inStep ? "#fff6e6" : byType[panel.type] ?? item?.color ?? "#c4a06a";
  return (
    <mesh
      position={[cx * explode, cy, cz * explode]}
      frustumCulled={false}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <boxGeometry args={[panel.size.width, panel.size.height, panel.size.depth]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1 || glass}
        opacity={opacity}
        roughness={glass ? 0.12 : 0.7}
        metalness={glass ? 0.15 : 0.03}
      />
    </mesh>
  );
}
