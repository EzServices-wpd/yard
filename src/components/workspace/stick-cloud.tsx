"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { getCatalogItem } from "@/lib/yard/catalog";
import type { Panel } from "@/lib/yard/types";
import { stockLook } from "@/lib/yard/stockLook";
import {
  BarPull,
  CupPull,
  DoorHinges,
  EdgeBand,
  PinHoles,
} from "@/components/workspace/panelHardware";

export { StickCloud } from "@/components/workspace/stickCloudCraft";
export { CarcaseJoins } from "@/components/workspace/carcaseJoins";

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
  const look = stockLook(item);
  const glass = panel.type === "glass_panel" || panel.type === "mirror";
  const opacity = hasStep && !inStep ? 0.28 : glass ? 0.42 : 1;
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
    const isDisc =
      panel.type === "top" &&
      (fittedShape === "round" || /cut\s*round|\bdia\b|diameter/i.test(panel.name));
    if (isDisc) {
      tex.repeat.set(2.2, 2.2);
    } else {
      const along = Math.max(w, h, d) / 16;
      const across = Math.min(w, h, d, 12) / 10;
      if (h >= w) tex.repeat.set(Math.max(across, 1), Math.max(along, 1));
      else tex.repeat.set(Math.max(along, 1), Math.max(across, 1));
    }
    tex.needsUpdate = true;
    return tex;
  }, [glass, look.map, w, h, d, panel.type, panel.name, fittedShape]);

  const isRoundTop =
    panel.type === "top" &&
    (fittedShape === "round" || /cut\s*round|\bdia\b|diameter/i.test(panel.name));
  const isPost = Math.min(w, d) <= 2.2 && h > Math.max(w, d) * 4;
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
        {!glass && opacity > 0.4 && !isRoundTop && !isPost && <EdgeBand w={w} h={h} d={d} />}
        {isDoor && opacity > 0.4 && <DoorHinges w={w} h={h} d={d} isLeft={isLeft} />}
        {isDoor && opacity > 0.4 && <BarPull w={w} h={h} d={d} isLeft={isLeft} />}
        {isDrawer && opacity > 0.4 && <CupPull w={w} h={h} d={d} />}
        {panel.type === "upright" && !isPost && h >= 24 && opacity > 0.4 && showPinHoles && (
          <PinHoles w={w} h={h} d={d} isLeft={isLeft} />
        )}
      </group>
    </group>
  );
}
