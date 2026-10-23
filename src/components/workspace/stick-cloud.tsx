"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { useYard } from "@/lib/yard/store";
import { getCatalogItem } from "@/lib/yard/catalog";
import type { Panel } from "@/lib/yard/types";
import { doorHingesLeft, isHingedLidPanel } from "@/lib/yard/operateFaces";
import { benchDrawerPull, benchPullDepth, benchWearsPull } from "@/components/workspace/drawerGroups";
import { stockLook } from "@/lib/yard/stockLook";
import { panelRenderLook } from "@/lib/yard/partStock";
import { isBoughtHardwareName } from "@/lib/yard/boughtHardware";
import {
  BarPull,
  CoatHook,
  CupPull,
  DoorHinges,
  EdgeBand,
  PinHoles,
} from "@/components/workspace/panelHardware";
import { useExplodeRefs } from "@/components/workspace/explode-driver";

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
  // The part's real stock — the same answer the cut list prints (walnut legs render walnut).
  const prompt = useYard((s) => s.project.prompt ?? "");
  // A shape Yard could not learn is a plain grey placeholder: no wood, no grain, nothing to buy.
  const placeholder = useYard((s) => !!s.project.displayOnly);
  const partLook = panelRenderLook(prompt, panel);
  const item = getCatalogItem(partLook.catalogId) ?? getCatalogItem(panel.materialId);
  const look = stockLook(item);
  const glass = panel.type === "glass_panel" || panel.type === "mirror";
  // A mirror set into a door rides on that door: it shows on the door's face and swings with it.
  const hostDoor = useYard((s) => (panel.joints?.length ? s.project.panels.find((q) => q.type === "door" && panel.joints!.some((j) => j.with === q.id)) : undefined));
  const mirror = panel.type === "mirror";
  // Step view: this step's parts keep their real wood tone with a warm glow and orange edges;
  // everything else steps back to a faint ghost so the lit parts read at a glance.
  const ghost = hasStep && !inStep;
  const opacity = ghost ? 0.16 : glass && !mirror ? 0.42 : 1;
  const color = placeholder ? "#9a9a9a" : ghost ? "#8a7c68" : mirror ? "#d3dce2" : partLook.color(!!look.map);
  const glow = inStep ? 0.22 : selected ? 0.14 : 0;
  const edgeColor = inStep ? "#e0782f" : ghost ? "#6b5d4a" : "#2a1d11";
  const { width: w, height: h, depth: d } = panel.size;

  const isDoor = panel.type === "door";
  const isDrawer = panel.type === "drawer";
  // Operate: a drawer slides as one group (shared drawer id, or its front plus the parts under it); a lone box keeps
  // today's own-depth pull (drawerGroups).
  // Tap a drawer while Operate is on: it opens alone to ~2/3 so its cavity shows; otherwise the stack staggers.
  const drawerPull = useYard((s) => benchDrawerPull(s.project.panels, panel, s.facesOpen ? s.selectedId : null));
  const wearsPull = useYard((s) => benchWearsPull(s.project.panels, panel));
  const pullDepth = useYard((s) => (wearsPull ? (isDrawer ? benchPullDepth(s.project.panels, panel) : d) : 0));
  const isLid = isHingedLidPanel(panel);
  const leaf = panel.leaf;
  // Doors/drawers/lids outside the current step are hidden (after every hook runs — see below).
  const hiddenInStep = hasStep && !inStep && (isDoor || !!hostDoor || isDrawer || isLid || !!leaf);

  const activeStep = useYard((s) => s.activeStep);
  const plan = useYard((s) => s.plan);
  const fittedShape = useYard((s) => s.project.fitted?.unit?.shape);
  const stepTitle = plan?.instructions.find((s) => s.step === activeStep)?.title ?? "";
  // Doors, drawers and lids sit shut on the bench by default (the model as built). They swing open
  // when you ask ("Open doors") or in the step that hangs them, so the hinge side reads.
  const faceStep = activeStep != null && /hang|door|drawer|front|pull|lid|piano|stay|hinge/i.test(stepTitle);
  const allowSwing = facesOpen ? activeStep == null || faceStep : faceStep && inStep;
  const open = allowSwing && !panel.yaw && (isDoor || !!hostDoor || drawerPull != null || isLid || !!leaf) && (!hasStep || inStep);
  // One hinge side for the model, the steps and the pull (operateFaces.doorHingesLeft).
  const isLeft = isDoor || hostDoor ? doorHingesLeft(hostDoor ?? panel) :
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
  } else if ((isDoor || hostDoor) && open) {
    const from = hostDoor ?? panel;
    const hingeX = isLeft ? from.position.x : from.position.x + from.size.width;
    const hingeZ = from.position.z + from.size.depth / 2;
    const swing = ((isLeft ? -1 : 1) * 72 * Math.PI) / 180;
    groupPos = [hingeX * explode, cy, hingeZ * explode];
    groupRot = [0, swing, 0];
    meshPos = [cx - hingeX, 0, cz - hingeZ];
  } else if (drawerPull != null && open) {
    groupPos = [cx * explode, cy, (cz + drawerPull) * explode];
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
    // Curved forms are never boxes: a dome is a half sphere on its base, a cone an open shell to a point.
    if (panel.form === "dome") return new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(w / 2, h, d / 2).translate(0, -h / 2, 0);
    if (panel.form === "cone") return new THREE.ConeGeometry(1, 1, 32, 1, true).scale(w / 2, h, d / 2);
    if (panel.strut) {
      const { a, b, r } = panel.strut;
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A);
      const geo = new THREE.CylinderGeometry(r, r, dir.length(), 16);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
      const mid = A.add(B).multiplyScalar(0.5);
      geo.translate(mid.x - w / 2, mid.y - h / 2, mid.z - d / 2);
      return geo;
    }
    if (poly && poly.pts.length >= 3) {
      // Odd-shape plate: real polygon. "xz" = plan outline extruded up; "xy" = face outline extruded back.
      const shape = new THREE.Shape();
      const holes = (u: number, v: number) => {
        for (const hole of poly.holes ?? []) { const path = new THREE.Path(); path.absarc(hole.x - u / 2, hole.y - v / 2, hole.r, 0, Math.PI * 2, true); shape.holes.push(path); }
      };
      if (poly.plane === "zy") {
        // Round face across x (a wheel on an x axle): outline in (z, y), extruded along x.
        poly.pts.forEach(([pz, py], i) => (i ? shape.lineTo(pz - d / 2, py - h / 2) : shape.moveTo(pz - d / 2, py - h / 2)));
        shape.closePath();
        holes(d, h);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 24 });
        geo.translate(0, 0, -w / 2);
        geo.rotateY(-Math.PI / 2);
        geo.computeVertexNormals();
        return geo;
      }
      if (poly.plane === "xz") {
        poly.pts.forEach(([px, pz], i) => (i ? shape.lineTo(px - w / 2, pz - d / 2) : shape.moveTo(px - w / 2, pz - d / 2)));
        shape.closePath();
        holes(w, d);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 24 });
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
      for (const cut of panel.cutouts ?? []) {
        const path = new THREE.Path();
        const x = cut.x - w / 2;
        const y = cut.y - h / 2;
        path.moveTo(x, y);
        path.lineTo(x + cut.width, y);
        path.lineTo(x + cut.width, y + cut.height);
        path.lineTo(x, y + cut.height);
        path.closePath();
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
  }, [panel.outline, panel.form, panel.strut, poly, w, h, d]);
  const topRadius = Math.min(w, d) / 2;
  const shadows = !!useShadows;
  // See inside: the staged explode moves these two groups (transform only, explode-driver.tsx).
  const ex = useExplodeRefs(panel.id);
  if (hiddenInStep) return null;

  // Bought coat hooks: steel hook glyph, never a wood box the same color as the rail.
  if (isBoughtHardwareName(panel.name)) {
    return (
      <group ref={ex.outer}><group ref={ex.inner}>
      <group position={groupPos} rotation={groupRot}>
        <group
          position={meshPos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <CoatHook w={w} h={h} d={d} />
        </group>
      </group>
      </group></group>
    );
  }

  return (
    <group ref={ex.outer}><group ref={ex.inner}>
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
            map={glass || placeholder ? undefined : grain ?? look.map ?? undefined}
            transparent={opacity < 1 || glass}
            opacity={opacity}
            roughness={glass ? 0.08 : look.roughness}
            metalness={glass ? 0.22 : look.metalness}
            envMapIntensity={glass ? 1.4 : look.env}
            emissive={glow ? "#ff8a3d" : "#000000"}
            emissiveIntensity={glow}
            depthWrite={opacity > 0.5}
            polygonOffset={mirror}
            polygonOffsetFactor={mirror ? -2 : 0}
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
        {wearsPull && opacity > 0.4 && <CupPull w={w} h={h} d={pullDepth} />}
        {panel.type === "upright" && !isPost && h >= 24 && opacity > 0.4 && showPinHoles && (
          <PinHoles w={w} h={h} d={d} isLeft={isLeft} />
        )}
      </group>
    </group>
    </group></group>
  );
}
