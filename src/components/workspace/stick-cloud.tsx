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
  meshDiameter,
  ROLE_TINT,
  spanOf,
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
        else dummy.scale.set(prim.length, prim.height, prim.width);
      } else {
        applyMemberPose(dummy, inst, prim, cylindrical, explode, pos, inst.rotation, overall);
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
        <cylinderGeometry args={[0.5, 0.5, 1, hollow ? 20 : 14, 1, hollow]} />
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
  const color = selected || inStep ? "#fff6e6" : item?.color ?? "#c4a06a";
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
    const swing = (isLeft ? 1 : -1) * (72 * Math.PI) / 180;
    groupPos = [hingeX * explode, cy, hingeZ * explode];
    groupRot = [0, swing, 0];
    meshPos = [isLeft ? w / 2 : -w / 2, 0, 0];
  } else if (isDrawer && open) {
    const pull = Math.min(d * 0.55, 8);
    groupPos = [cx * explode, cy, (cz + pull) * explode];
  }

  return (
    <group position={groupPos} rotation={groupRot}>
      <mesh
        position={meshPos}
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
          map={glass ? undefined : look.map ?? undefined}
          transparent={opacity < 1 || glass}
          opacity={opacity}
          roughness={glass ? 0.08 : look.roughness}
          metalness={glass ? 0.22 : look.metalness}
          envMapIntensity={glass ? 1.4 : look.env}
        />
      </mesh>
    </group>
  );
}
