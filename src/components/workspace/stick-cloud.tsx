"use client";

import { useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { getCatalogItem } from "@/lib/yard/catalog";
import type { Panel, Vec3, YardProject } from "@/lib/yard/types";
import { stockLook } from "@/lib/yard/stockLook";

const SCREW_HEAD = "#c0c0c0";

function useShadows() {
  return true;
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

function DoorHinges({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  return null;
}

function BarPull({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  return null;
}

function CupPull({ w, h, d }: { w: number; h: number; d: number }) {
  return null;
}

function PinHoles({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  return null;
}

export function PanelMesh({
  panel,
  selected,
  onSelect,
  explode,
  facesOpen,
  hasStep,
  inStep,
  showPinHoles,
}: {
  panel: Panel;
  selected: boolean;
  onSelect: () => void;
  explode: number;
  facesOpen: boolean;
  hasStep: boolean;
  inStep: boolean;
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
  const stepTitle = plan?.instructions.find((s) => s.step === activeStep)?.title ?? "";
  const allowSwing =
    facesOpen && (activeStep == null || /hang|door|drawer|front|pull/i.test(stepTitle));
  const open = allowSwing && (isDoor || isDrawer) && (!hasStep || inStep);
  const isLeft = /left/i.test(panel.name) || (!/right/i.test(panel.name) && panel.position.x + w / 2 < 0);

  const cx = panel.position.x + panel.size.width / 2;
  const cy = panel.position.y + panel.size.height / 2;
  const cz = panel.position.z + panel.size.depth / 2;

  let groupPos: [number, number, number] = [cx * explode, cy, cz * explode];
  let groupRot: [number, number, number] = [0, 0, 0];
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

  // Round table tops: disc mesh (cut list still uses the square blank).
  const isRoundTop = panel.type === "top" && /cut round|Ø|diameter/i.test(panel.name);
  const topRadius = Math.min(w, d) / 2;

  return (
    <group position={groupPos} rotation={groupRot}>
      <group position={meshPos}>
        <mesh
          frustumCulled={false}
          castShadow={!!useShadows()}
          receiveShadow={!!useShadows()}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isRoundTop ? (
            <cylinderGeometry args={[topRadius, topRadius, h, 48]} />
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
        {isDoor && opacity > 0.4 && <DoorHinges w={w} h={h} d={d} isLeft={isLeft} />}
        {isDoor && opacity > 0.4 && <BarPull w={w} h={h} d={d} isLeft={isLeft} />}
        {isDrawer && opacity > 0.4 && <CupPull w={w} h={h} d={d} />}
        {panel.type === "upright" && h >= 24 && opacity > 0.4 && showPinHoles && (
          <PinHoles w={w} h={h} d={d} isLeft={isLeft} />
        )}
      </group>
    </group>
  );
}

function BenchScene({ project }: { project: YardProject }) {
  const selectedId = useYard((s) => s.selectedId);
  const select = useYard((s) => s.select);
  const explode = useYard((s) => s.explode);
  const facesOpen = useYard((s) => s.facesOpen);
  const activeStep = useYard((s) => s.activeStep);
  const plan = useYard((s) => s.plan);
  const showPinHoles = true;

  const stepParts = plan?.instructions.find((s) => s.step === activeStep)?.partsUsed ?? null;
  const hasStep = activeStep != null && !!stepParts;
  const inStepIds = new Set(stepParts ?? []);

  const exp = explode ? 1.35 : 1;

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow />
      <Environment preset="warehouse" environmentIntensity={0.88} background={false} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={80} blur={2.5} />
      {project.panels.map((p) => {
        const inStep =
          !hasStep ||
          inStepIds.has("*") ||
          inStepIds.has(p.id) ||
          inStepIds.has(p.name) ||
          inStepIds.some?.((id) => p.name.toLowerCase().includes(String(id).toLowerCase()));
        const inStepBool = Array.isArray(stepParts)
          ? stepParts.includes("*") ||
            stepParts.includes(p.id) ||
            stepParts.includes(p.name) ||
            stepParts.some((id) => p.name.toLowerCase().includes(String(id).toLowerCase()))
          : true;
        return (
          <PanelMesh
            key={p.id}
            panel={p}
            selected={selectedId === p.id}
            onSelect={() => select(p.id)}
            explode={exp}
            facesOpen={facesOpen}
            hasStep={hasStep}
            inStep={!hasStep || inStepBool}
            showPinHoles={showPinHoles}
          />
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
      <OrbitControls makeDefault target={[0, project.overall.height / 3, 0]} />
    </>
  );
}

export function StickCloud() {
  const project = useYard((s) => s.project);
  const camera = useYard((s) => s.camera);

  const camPos: [number, number, number] =
    camera === "front"
      ? [0, project.overall.height * 0.5, Math.max(project.overall.width, project.overall.depth) * 1.8]
      : camera === "side"
        ? [Math.max(project.overall.width, project.overall.depth) * 1.8, project.overall.height * 0.5, 0]
        : camera === "top"
          ? [0, Math.max(project.overall.width, project.overall.depth) * 1.6, 0.01]
          : [
              project.overall.width * 0.9,
              project.overall.height * 0.85,
              project.overall.depth * 1.2,
            ];

  return (
    <div className="absolute inset-0 bg-[#0c0c0c]">
      <Canvas shadows camera={{ position: camPos, fov: 35, near: 0.5, far: 500 }}>
        <BenchScene project={project} />
      </Canvas>
    </div>
  );
}
