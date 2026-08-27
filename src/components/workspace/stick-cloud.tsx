"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { getCatalogItem } from "@/lib/yard/catalog";
import type { Panel, Vec3, WorkMode, YardInstance, YardProject } from "@/lib/yard/types";
import { stockLook } from "@/lib/yard/stockLook";

/** Join markers — no-op when exploded. */
export function CarcaseJoins({
  panels,
  explode,
}: {
  panels: Panel[];
  explode: number;
}) {
  if (Math.abs(explode - 1) > 0.05) return null;
  return null;
}

function EdgeBand({ w, h, d }: { w: number; h: number; d: number }) {
  const t = 0.04;
  return (
    <group>
      <mesh position={[0, h / 2 - t / 2, 0]}>
        <boxGeometry args={[w + 0.01, t, d + 0.01]} />
        <meshStandardMaterial color="#d4b896" roughness={0.65} />
      </mesh>
      <mesh position={[0, -h / 2 + t / 2, 0]}>
        <boxGeometry args={[w + 0.01, t, d + 0.01]} />
        <meshStandardMaterial color="#d4b896" roughness={0.65} />
      </mesh>
    </group>
  );
}

export function PanelMesh({
  panel,
  explode,
  selected,
  inStep,
  hasStep,
  onSelect,
  useShadows,
  facesOpen = true,
  showPinHoles = false,
}: {
  panel: Panel;
  explode: number;
  selected: boolean;
  inStep: boolean;
  hasStep: boolean;
  onSelect: () => void;
  useShadows?: boolean;
  facesOpen?: boolean;
  showPinHoles?: boolean;
}) {
  const item = getCatalogItem(panel.materialId);
  const look = stockLook(panel.materialId);
  const glass = /glass|mirror/i.test(panel.name + (panel.type ?? ""));
  const opacity = hasStep && !inStep ? 0.06 : glass ? 0.42 : 1;
  const color =
    hasStep && !inStep
      ? "#b5a690"
      : selected || inStep
        ? "#fff6e6"
        : look.map
          ? "#f3e6cc"
          : item?.color ?? "#c4a06a";
  const { width: w, height: h, depth: d } = panel.size;

  const isDoor = panel.type === "door";
  const isDrawer = panel.type === "drawer";
  if (hasStep && !inStep && (isDoor || isDrawer)) return null;

  const activeStep = useYard((s) => s.activeStep);
  const plan = useYard((s) => s.plan);
  const fittedShape = useYard((s) => s.project.fitted?.unit?.shape);
  const stepTitle = plan?.instructions.find((s) => s.step === activeStep)?.title ?? "";
  const allowSwing =
    facesOpen && (activeStep == null || /hang|door|drawer|front|pull/i.test(stepTitle));
  const open = allowSwing && (isDoor || isDrawer) && (!hasStep || inStep);
  const isLeft =
    /left/i.test(panel.name) || (!/right/i.test(panel.name) && panel.position.x + w / 2 < 0);

  const cx = panel.position.x + w / 2;
  const cy = panel.position.y + h / 2;
  const cz = panel.position.z + d / 2;
  const yaw = panel.yaw ?? 0;

  let groupPos: [number, number, number] = [cx * explode, cy, cz * explode];
  let groupRot: [number, number, number] = [0, yaw, 0];
  let meshPos: [number, number, number] = [0, 0, 0];

  if (isDoor && open) {
    const hingeX = isLeft ? panel.position.x : panel.position.x + w;
    const hingeZ = panel.position.z + d / 2;
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
    const tex = look.map.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    const along = Math.max(w, h, d) / 16;
    const across = Math.min(w, h, d, 12) / 10;
    if (h >= w) tex.repeat.set(Math.max(across, 1), Math.max(along, 1));
    else tex.repeat.set(Math.max(along, 1), Math.max(across, 1));
    tex.needsUpdate = true;
    return tex;
  }, [glass, look.map, w, h, d]);

  const isRoundTop =
    panel.type === "top" &&
    (fittedShape === "round" || /cut\s*round|\bdia\b|diameter/i.test(panel.name));
  const topRadius = Math.min(w, d) / 2;
  const shadows = !!useShadows;

  return (
    <group position={groupPos} rotation={groupRot}>
      <group position={meshPos}>
        <mesh
          frustumCulled={false}
          castShadow={shadows}
          receiveShadow={shadows}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isRoundTop ? (
            <cylinderGeometry args={[topRadius, topRadius, h, 64]} />
          ) : (
            <boxGeometry args={[w, h, d]} />
          )}
          <meshStandardMaterial
            color={color}
            map={glass ? undefined : grain ?? look.map ?? undefined}
            transparent={opacity < 1 || glass}
            opacity={opacity}
            roughness={glass ? 0.08 : look.roughness}
            metalness={glass ? 0.22 : look.metalness}
            envMapIntensity={glass ? 1.4 : look.env}
            depthWrite={opacity > 0.5}
          />
        </mesh>
        {!glass && opacity > 0.4 && !isRoundTop && <EdgeBand w={w} h={h} d={d} />}
      </group>
    </group>
  );
}

export function StickCloud({
  instances,
  explode,
  selectedId,
  onSelect,
  useShadows,
}: {
  instances: YardInstance[];
  explode: number;
  selectedId: string | null;
  workMode?: WorkMode;
  stepIds?: string[];
  placedIds?: string[];
  lockedIds?: string[];
  dragPos?: { id: string; pos: Vec3 } | null;
  overall?: { width: number; height: number; depth: number };
  onSelect: (id: string | null) => void;
  joinMethod?: string;
  useShadows?: boolean;
}) {
  if (!instances?.length) return null;
  return (
    <group>
      {instances.map((inst) => {
        const item = getCatalogItem(inst.catalogId);
        const len = inst.cutLength ?? 36;
        const selected = selectedId === inst.id;
        return (
          <mesh
            key={inst.id}
            position={[
              inst.position.x * explode,
              inst.position.y + len / 2,
              inst.position.z * explode,
            ]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(inst.id);
            }}
            castShadow={!!useShadows}
          >
            <boxGeometry args={[1.5, len, 3.5]} />
            <meshStandardMaterial
              color={selected ? "#fff6e6" : item?.color ?? "#c4a06a"}
              roughness={0.7}
            />
          </mesh>
        );
      })}
    </group>
  );
}
