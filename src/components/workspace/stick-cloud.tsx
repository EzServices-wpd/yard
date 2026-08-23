"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getCatalogItem } from "@/lib/yard/catalog";
import { meshKind, visualPrimitive } from "@/lib/yard/geometry";
import { stockLook } from "@/lib/yard/stockLook";
import { useYard } from "@/lib/yard/store";
import {
  applyMemberPose,
  displayPos,
  flatBarGeometry,
  pipeGeometry,
  meshDiameter,
  ROLE_TINT,
  spanOf,
  SCREW_HEAD,
} from "@/components/workspace/stick-helpers";
import { BinderCloud } from "@/components/workspace/binder-cloud";
import type { Panel, Vec3, WorkMode, YardInstance, YardProject } from "@/lib/yard/types";

type Row = {
  inst: YardInstance;
  index: number;
  item: NonNullable<ReturnType<typeof getCatalogItem>>;
  prim: ReturnType<typeof visualPrimitive>;
};

export function StickCloud({
  instances, explode, selectedId, workMode, stepIds, placedIds, lockedIds, dragPos, overall, onSelect, joinMethod, useShadows,
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
  joinMethod?: YardProject["joinMethod"];
  useShadows?: boolean;
}) {
  const span = spanOf(overall);
  const groups = useMemo(() => {
    const flatBars: Row[] = [];
    const boxes: Row[] = [];
    const solidCyls: Row[] = [];
    const hollowCyls: Row[] = [];
    instances.forEach((inst, index) => {
      const item = getCatalogItem(inst.catalogId);
      if (!item) return;
      const prim = visualPrimitive(item, inst.cutLength, span);
      const row: Row = { inst, index, item, prim };
      const k = meshKind(item);
      if (k === "flatBar") flatBars.push(row);
      else if (k === "box") boxes.push(row);
      else if (k === "cylinder") solidCyls.push(row);
      else hollowCyls.push(row);
    });
    return { flatBars, boxes, solidCyls, hollowCyls };
  }, [instances, span]);

  const common = { explode, selectedId, workMode, stepIds, placedIds, lockedIds, dragId: dragPos?.id ?? null, overall, count: instances.length, onSelect, useShadows };

  const solidBars = useMemo(
    () => [...groups.flatBars, ...groups.boxes],
    [groups.flatBars, groups.boxes],
  );
  const cyls = useMemo(
    () => [...groups.solidCyls, ...groups.hollowCyls],
    [groups.solidCyls, groups.hollowCyls],
  );

  return (
    <group>
      <CloudKind rows={groups.flatBars} {...common} cylindrical={false} hollow={false} flatBar />
      <CloudKind rows={groups.boxes} {...common} cylindrical={false} hollow={false} />
      <CloudKind rows={groups.solidCyls} {...common} cylindrical={true} hollow={false} />
      <CloudKind rows={groups.hollowCyls} {...common} cylindrical={true} hollow={true} />
      {workMode !== "build" && (
        <BinderCloud cyls={cyls} boxes={solidBars} explode={explode} joinMethod={joinMethod} />
      )}
    </group>
  );
}

function CloudKind({
  rows, explode, selectedId, workMode, stepIds, placedIds, lockedIds, dragId, overall, count, onSelect, cylindrical, hollow, flatBar = false, useShadows,
}: {
  rows: Row[];
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
  hollow: boolean;
  flatBar?: boolean;
  useShadows?: boolean;
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
        const diameter = meshDiameter(prim, cylindrical);
        if (cylindrical) dummy.scale.set(diameter, prim.length, diameter);
        else if (flatBar) dummy.scale.set(prim.length, prim.width, prim.height);
        else dummy.scale.set(prim.length, prim.height, prim.width);
      } else {
        applyMemberPose(dummy, inst, prim, cylindrical, explode, pos, inst.rotation, overall, flatBar);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const inStep = hasStep && stepIds.includes(inst.id);
      const selected = inst.id === selectedId;
      const stock = live[i].item.color || ROLE_TINT[inst.role ?? ""] || "#e0b86a";
      color.set(hasStep && !inStep ? "#5c5348" : selected || inStep ? "#fff1d0" : stock);
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
    const locked =
      workMode === "look" ||
      workMode === "walk" ||
      (workMode === "free" && lockedIds.includes(inst.id)) ||
      (workMode === "build" && placedIds.includes(inst.id));
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
    if (e.nativeEvent.shiftKey) next.y = Math.max(0.1, Math.round((start.current.pos.y + delta.y) * 4) / 4);
    else {
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
  const look = stockLook(live[0]?.item);
  const innerFrac =
    hollow && live[0]?.prim.radius
      ? (live[0].prim.innerRadius ?? live[0].prim.radius * 0.72) / live[0].prim.radius
      : 0.76;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, Math.max(live.length, 1)]}
      frustumCulled={false}
      castShadow={!!useShadows}
      receiveShadow={!!useShadows}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {cylindrical ? (
        hollow ? (
          <primitive object={pipeGeometry(innerFrac)} attach="geometry" />
        ) : (
          <cylinderGeometry args={[0.5, 0.5, 1, 14, 1]} />
        )
      ) : flatBar ? (
        <primitive object={flatBarGeometry()} attach="geometry" />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      <meshStandardMaterial
        roughness={look.roughness}
        metalness={look.metalness}
        map={look.map ?? undefined}
        envMapIntensity={look.env}
      />
    </instancedMesh>
  );
}

export function PanelMesh({
  panel, explode, selected, inStep, hasStep, onSelect, useShadows, facesOpen = true,
}: {
  panel: Panel;
  explode: number;
  selected: boolean;
  inStep: boolean;
  hasStep: boolean;
  onSelect: () => void;
  useShadows?: boolean;
  facesOpen?: boolean;
}) {
  const item = getCatalogItem(panel.materialId);
  const look = stockLook(item);
  const cx = panel.position.x + panel.size.width / 2;
  const cy = panel.position.y + panel.size.height / 2;
  const cz = panel.position.z + panel.size.depth / 2;
  const glass = panel.type === "glass_panel" || panel.type === "mirror";
  const opacity = hasStep && !inStep ? 0.2 : glass ? 0.42 : 1;
  const color = selected || inStep ? "#fff6e6" : look.map ? "#f3e6cc" : item?.color ?? "#c4a06a";
  const { width: w, height: h, depth: d } = panel.size;

  const isDoor = panel.type === "door";
  const isDrawer = panel.type === "drawer";
  const open = facesOpen && (isDoor || isDrawer);
  const isLeft = /left/i.test(panel.name) || (!/right/i.test(panel.name) && panel.position.x + w / 2 < 0);

  let groupPos: [number, number, number] = [cx * explode, cy, cz * explode];
  let groupRot: [number, number, number] = [0, 0, 0];
  let meshPos: [number, number, number] = [0, 0, 0];

  if (isDoor && open) {
    const hingeX = isLeft ? panel.position.x : panel.position.x + w;
    const hingeZ = panel.position.z + d / 2;
    // Overlay doors open into the room (+Z). Three.js +Y rotation sends +X toward -Z,
    // so a left-hand leaf (offset +X) takes a negative angle.
    const swing = ((isLeft ? -1 : 1) * 72 * Math.PI) / 180;
    groupPos = [hingeX * explode, cy, hingeZ * explode];
    groupRot = [0, swing, 0];
    meshPos = [isLeft ? w / 2 : -w / 2, 0, 0];
  } else if (isDrawer && open) {
    const pull = Math.max(8, Math.min(d * 0.75, 16));
    groupPos = [cx * explode, cy, (cz + pull) * explode];
  }

  const grain = useMemo(() => {
    if (glass || !look.map) return null;
    const t = look.map.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    const along = Math.max(w, h, d) / 16;
    const across = Math.min(w, h, d, 12) / 10;
    if (h >= w) t.repeat.set(Math.max(across, 1), Math.max(along, 1));
    else t.repeat.set(Math.max(along, 1), Math.max(across, 1));
    t.needsUpdate = true;
    return t;
  }, [glass, look.map, w, h, d]);

  return (
    <group position={groupPos} rotation={groupRot}>
      <group position={meshPos}>
        <mesh
          frustumCulled={false}
          castShadow={!!useShadows}
          receiveShadow={!!useShadows}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={color}
            map={glass ? undefined : grain ?? look.map ?? undefined}
            transparent={opacity < 1 || glass}
            opacity={opacity}
            roughness={glass ? 0.08 : look.roughness}
            metalness={glass ? 0.22 : look.metalness}
            envMapIntensity={glass ? 1.4 : look.env}
          />
        </mesh>
        {!glass && opacity > 0.4 && <EdgeBand w={w} h={h} d={d} />}
        {isDoor && opacity > 0.4 && <DoorHinges w={w} h={h} d={d} isLeft={isLeft} />}
        {isDoor && opacity > 0.4 && <BarPull w={w} h={h} d={d} isLeft={isLeft} />}
        {isDrawer && opacity > 0.4 && <CupPull w={w} h={h} d={d} />}
        {panel.type === "upright" && h >= 24 && opacity > 0.4 && (
          <PinHoles w={w} h={h} d={d} isLeft={isLeft} />
        )}
      </group>
    </group>
  );
}

const BAND = "#c49a62";
const STEEL = "#8c9096";
const PULL = "#3e3832";
const PIN = "#d4cdc4";

function EdgeBand({ w, h, d }: { w: number; h: number; d: number }) {
  const face = w * h >= w * d && w * h >= h * d ? "xy" : w * d >= h * d ? "xz" : "yz";
  const t = Math.min(0.16, Math.min(w, h, d) * 0.28);
  const mat = <meshStandardMaterial color={BAND} roughness={0.58} metalness={0.04} />;
  if (face === "xy") {
    return (
      <group>
        <mesh position={[0, h / 2 - t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
        <mesh position={[0, -h / 2 + t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
        <mesh position={[-w / 2 + t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h - t * 2, d + 0.01]} /></mesh>
        <mesh position={[w / 2 - t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h - t * 2, d + 0.01]} /></mesh>
      </group>
    );
  }
  if (face === "xz") {
    return (
      <group>
        <mesh position={[0, 0, d / 2 - t / 2]}>{mat}<boxGeometry args={[w + 0.01, h + 0.01, t]} /></mesh>
        <mesh position={[0, 0, -d / 2 + t / 2]}>{mat}<boxGeometry args={[w + 0.01, h + 0.01, t]} /></mesh>
        <mesh position={[-w / 2 + t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h + 0.01, d - t * 2]} /></mesh>
        <mesh position={[w / 2 - t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h + 0.01, d - t * 2]} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, h / 2 - t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
      <mesh position={[0, -h / 2 + t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
      <mesh position={[0, 0, d / 2 - t / 2]}>{mat}<boxGeometry args={[w + 0.01, h - t * 2, t]} /></mesh>
      <mesh position={[0, 0, -d / 2 + t / 2]}>{mat}<boxGeometry args={[w + 0.01, h - t * 2, t]} /></mesh>
    </group>
  );
}

function DoorHinges({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  const x = isLeft ? -w / 2 + 0.85 : w / 2 - 0.85;
  const z = -d / 2 + 0.12;
  const ys = [h / 2 - 3.5, -h / 2 + 3.5];
  return (
    <group>
      {ys.map((y) => (
        <group key={y} position={[x, y, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 0.22, 20]} />
            <meshStandardMaterial color={STEEL} metalness={0.72} roughness={0.32} />
          </mesh>
          <mesh position={[isLeft ? 0.55 : -0.55, 0, -0.18]}>
            <boxGeometry args={[0.9, 0.42, 0.12]} />
            <meshStandardMaterial color={STEEL} metalness={0.65} roughness={0.38} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BarPull({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  const x = isLeft ? w / 2 - 1.1 : -w / 2 + 1.1;
  const z = d / 2 + 0.28;
  return (
    <group position={[x, 0, z]}>
      <mesh>
        <boxGeometry args={[0.28, 4.2, 0.28]} />
        <meshStandardMaterial color={PULL} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.7, -0.22]}>
        <boxGeometry args={[0.22, 0.22, 0.4]} />
        <meshStandardMaterial color={PULL} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, -1.7, -0.22]}>
        <boxGeometry args={[0.22, 0.22, 0.4]} />
        <meshStandardMaterial color={PULL} metalness={0.55} roughness={0.4} />
      </mesh>
    </group>
  );
}

function CupPull({ d }: { w: number; h: number; d: number }) {
  return (
    <mesh position={[0, 0, d / 2 + 0.22]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.55, 0.7, 0.35, 16, 1, true]} />
      <meshStandardMaterial color={PULL} metalness={0.5} roughness={0.42} side={THREE.DoubleSide} />
    </mesh>
  );
}

function PinHoles({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  const x = isLeft ? w / 2 - 0.08 : -w / 2 + 0.08;
  const z = d / 2 - 1.25;
  const start = -h / 2 + 8;
  const end = h / 2 - 6;
  const step = 4;
  const ys: number[] = [];
  for (let y = start; y <= end; y += step) ys.push(y);
  return (
    <group>
      {ys.map((y) => (
        <mesh key={y} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.28, 8]} />
          <meshStandardMaterial color={PIN} roughness={0.55} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

const JOIN_TYPES = new Set(["shelf", "top", "bottom", "divider", "counter", "back"]);

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** #8 heads + glue lines at carcase butts. Hidden when exploded so parts can still fly apart. */
export function CarcaseJoins({ panels, explode }: { panels: Panel[]; explode: number }) {
  if (Math.abs(explode - 1) > 0.05) return null;
  const uprights = panels.filter((p) => p.type === "upright");
  const members = panels.filter((p) => JOIN_TYPES.has(p.type));
  if (!uprights.length || !members.length) return null;

  const screws: { x: number; y: number; z: number; rx: number; rz: number }[] = [];
  const glues: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];

  for (const u of uprights) {
    const left = /left/i.test(u.name) || u.position.x + u.size.width / 2 < 0;
    const innerX = left ? u.position.x + u.size.width : u.position.x;
    const ux0 = u.position.x;
    const ux1 = u.position.x + u.size.width;
    const uy0 = u.position.y;
    const uy1 = u.position.y + u.size.height;
    const uz0 = u.position.z;
    const uz1 = u.position.z + u.size.depth;

    for (const m of members) {
      const mx0 = m.position.x;
      const mx1 = m.position.x + m.size.width;
      const my0 = m.position.y;
      const my1 = m.position.y + m.size.height;
      const mz0 = m.position.z;
      const mz1 = m.position.z + m.size.depth;
      const oy = overlap(uy0, uy1, my0, my1);
      const oz = overlap(uz0, uz1, mz0, mz1);
      if (oy < 0.2 || oz < 0.2) continue;
      const near =
        Math.abs(mx0 - innerX) < 0.35 ||
        Math.abs(mx1 - innerX) < 0.35 ||
        (mx0 < innerX && mx1 > innerX);
      if (!near && m.type !== "back") continue;

      const y = (Math.max(uy0, my0) + Math.min(uy1, my1)) / 2;
      if (m.type === "back") {
        const z = m.position.z + m.size.depth / 2 + 0.04;
        const span = Math.min(uy1, my1) - Math.max(uy0, my0);
        const n = span > 40 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / (n + 1);
          screws.push({ x: innerX, y: uy0 + span * t, z, rx: Math.PI / 2, rz: 0 });
        }
        continue;
      }
      const zFront = Math.max(uz0, mz0) + 1.1;
      const zBack = Math.min(uz1, mz1) - 1.1;
      const proud = left ? 0.05 : -0.05;
      screws.push({ x: innerX + proud, y, z: zFront, rx: 0, rz: left ? -Math.PI / 2 : Math.PI / 2 });
      if (zBack - zFront > 2) {
        screws.push({ x: innerX + proud, y, z: zBack, rx: 0, rz: left ? -Math.PI / 2 : Math.PI / 2 });
      }
      const gz = (Math.max(uz0, mz0) + Math.min(uz1, mz1)) / 2;
      const gd = Math.max(0.4, Math.min(uz1, mz1) - Math.max(uz0, mz0) - 0.3);
      glues.push({
        x: innerX,
        y,
        z: gz,
        w: 0.05,
        h: Math.min(m.size.height, 0.75) + 0.02,
        d: gd,
      });
    }
  }

  return (
    <group>
      {screws.map((s, i) => (
        <mesh key={`s${i}`} position={[s.x, s.y, s.z]} rotation={[s.rx, 0, s.rz]}>
          <cylinderGeometry args={[0.16, 0.16, 0.07, 10]} />
          <meshStandardMaterial color={SCREW_HEAD} metalness={0.55} roughness={0.4} />
        </mesh>
      ))}
      {glues.map((g, i) => (
        <mesh key={`g${i}`} position={[g.x, g.y, g.z]}>
          <boxGeometry args={[g.w, g.h, g.d]} />
          <meshStandardMaterial color="#a67c45" roughness={0.7} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
