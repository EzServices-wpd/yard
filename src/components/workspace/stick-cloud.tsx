"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { useYard } from "@/lib/yard/store";
import { getCatalogItem } from "@/lib/yard/catalog";
import type { Panel } from "@/lib/yard/types";
import { isHingedLidPanel } from "@/lib/yard/operateFaces";
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
  // Step view: this step's parts keep their real wood tone with a warm glow and orange edges;
  // everything else steps back to a faint ghost so the lit parts read at a glance.
  const ghost = hasStep && !inStep;
  const opacity = ghost ? 0.16 : glass ? 0.42 : 1;
  const color = ghost ? "#8a7c68" : look.map ? "#e9d6b4" : item?.color ?? "#c4a06a";
  const glow = inStep ? 0.22 : selected ? 0.14 : 0;
  const edgeColor = inStep ? "#e0782f" : ghost ? "#6b5d4a" : "#2a1d11";
  const { width: w, height: h, depth: d } = panel.size;

  const isDoor = panel.type === "door";
  const isDrawer = panel.type === "drawer";
  const isLid = isHingedLidPanel(panel);
  const leaf = panel.leaf;
  // Doors/drawers/lids outside the current step are hidden (after every hook runs — see below).
  const hiddenInStep = hasStep && !inStep && (isDoor || isDrawer || isLid || !!leaf);

  const activeStep = useYard((s) => s.activeStep);
  const plan = useYard((s) => s.plan);
  const fittedShape = useYard((s) => s.project.fitted?.unit?.shape);
  const stepTitle = plan?.instructions.find((s) => s.step === activeStep)?.title ?? "";
  // Doors, drawers and lids sit shut on the bench by default (the model as built). They swing open
  // when you ask ("Open doors") or in the step that hangs them, so the hinge side reads.
  const faceStep = activeStep != null && /hang|door|drawer|front|pull|lid|piano|stay|hinge/i.test(stepTitle);
  const allowSwing = facesOpen ? activeStep == null || faceStep : faceStep && inStep;
  const open = allowSwing && !panel.yaw && (isDoor || isDrawer || isLid || !!leaf) && (!hasStep || inStep);
  const isLeft =
    /left/i.test(panel.name) || (!/right/i.test(panel.name) && panel.position.x + w / 2 < 0);

  const cx = panel.position.x + w / 2;
  const cy = panel.position.y + h / 2;
  const cz = panel.position.z + d / 2;
  const yaw = panel.yaw ?? 0;

  let groupPos: [number, number, number] = [cx * explode, cy, cz * explode];
  // panel.yaw is Three.js Y-up radians (see tableFitted / panelWorldCorners).
  let groupRot: [number, number, number] = [0, yaw, 0];
  let meshPos: [number, number, number] = [0, 0, 0];

  if (leaf && open) {
    const left = leaf.hinge === "left";
    const swing = ((left ? -1 : 1) * 72 * Math.PI) / 180;
    groupPos = [leaf.hingeX * explode, cy, leaf.hingeZ * explode];
    groupRot = [0, swing, 0];
    meshPos = [panel.position.x + w / 2 - leaf.hingeX, 0, panel.position.z + d / 2 - leaf.hingeZ];
  } else if (isDoor && open) {
    const hingeX = isLeft ? panel.position.x : panel.position.x + w;
    const hingeZ = panel.position.z + d / 2;
    const swing = ((isLeft ? -1 : 1) * 72 * Math.PI) / 180;
    groupPos = [hingeX * explode, cy, hingeZ * explode];
    groupRot = [0, swing, 0];
    meshPos = [isLeft ? w / 2 : -w / 2, 0, 0];
  } else if (isDrawer && open) {
    const pull = Math.max(8, Math.min(d * 0.75, 16));
    groupPos = [cx * explode, cy, (cz + pull) * explode];
  } else if (isLid && open) {
    // Piano hinge along the back edge — lid opens up and back (pitch about X).
    const hingeY = panel.position.y;
    const hingeZ = panel.position.z;
    const swing = (-80 * Math.PI) / 180;
    groupPos = [cx * explode, hingeY, hingeZ * explode];
    groupRot = [swing, yaw, 0];
    meshPos = [0, h / 2, d / 2];
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
  // Corner-unit plates: right triangle or quarter-round, right angle at −x/−z (the wall corner).
  const poly = panel.polygon;
  const outlineGeo = useMemo(() => {
    if (poly && poly.pts.length >= 3) {
      // Odd-shape plate: real polygon. "xz" = plan outline extruded up; "xy" = face outline extruded back.
      const shape = new THREE.Shape();
      if (poly.plane === "xz") {
        poly.pts.forEach(([px, pz], i) => (i ? shape.lineTo(px - w / 2, pz - d / 2) : shape.moveTo(px - w / 2, pz - d / 2)));
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        geo.translate(0, h / 2, 0);
        geo.computeVertexNormals();
        return geo;
      }
      poly.pts.forEach(([px, py], i) => (i ? shape.lineTo(px - w / 2, py - h / 2) : shape.moveTo(px - w / 2, py - h / 2)));
      shape.closePath();
      for (const hole of poly.holes ?? []) {
        const path = new THREE.Path();
        path.absarc(hole.x - w / 2, hole.y - h / 2, hole.r, 0, Math.PI * 2, true);
        shape.holes.push(path);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 24 });
      geo.translate(0, 0, -d / 2);
      geo.computeVertexNormals();
      return geo;
    }
    if (!panel.outline) return null;
    const shape = new THREE.Shape();
    const x0 = -w / 2;
    const y0 = -d / 2;
    shape.moveTo(x0, y0);
    shape.lineTo(x0 + w, y0);
    if (panel.outline === "quarter-round") {
      shape.absarc(x0, y0, Math.min(w, d), 0, Math.PI / 2, false);
    } else {
      shape.lineTo(x0, y0 + d);
    }
    shape.lineTo(x0, y0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 32 });
    // Shape XY → world XZ (shape +Y → world +Z), extrude along world Y, centered.
    geo.rotateX(Math.PI / 2);
    geo.translate(0, h / 2, 0);
    geo.computeVertexNormals();
    return geo;
  }, [panel.outline, poly, w, h, d]);
  const topRadius = Math.min(w, d) / 2;
  const shadows = !!useShadows;
  if (hiddenInStep) return null;

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
          {outlineGeo ? (
            <primitive object={outlineGeo} attach="geometry" />
          ) : isRoundTop ? (
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
            emissive={glow ? "#ff8a3d" : "#000000"}
            emissiveIntensity={glow}
            depthWrite={opacity > 0.5}
          />
          {/* Thin dark outline on every panel so neighbouring parts read as separate pieces. */}
          {!glass && (
            <Edges
              threshold={25}
              color={edgeColor}
              lineWidth={inStep ? 1.8 : 1}
              transparent
              opacity={ghost ? 0.35 : inStep ? 0.95 : 0.55}
              depthWrite={false}
              layers={1}
            />
          )}
        </mesh>
        {/* Rails/aprons: EdgeBand top strips sit flat under the top and read as
            scrambled bars on yawed 3-leg chords. Skip banding on rails + yawed members. */}
        {!glass && opacity > 0.4 && !isRoundTop && !outlineGeo && !isPost && panel.type !== "rail" && !(panel.yaw) && (
          <EdgeBand w={w} h={h} d={d} />
        )}
        {opacity > 0.4 && (leaf ? leaf.role === "hinge" : isDoor) && (
          <DoorHinges w={w} h={h} d={d} isLeft={leaf ? leaf.hinge === "left" : isLeft} />
        )}
        {opacity > 0.4 && (leaf ? leaf.role === "pull" : isDoor) && (
          <BarPull w={w} h={h} d={d} isLeft={leaf ? leaf.hinge === "left" : isLeft} />
        )}
        {isDrawer && opacity > 0.4 && <CupPull w={w} h={h} d={d} />}
        {panel.type === "upright" && !isPost && h >= 24 && opacity > 0.4 && showPinHoles && (
          <PinHoles w={w} h={h} d={d} isLeft={isLeft} />
        )}
      </group>
    </group>
  );
}
