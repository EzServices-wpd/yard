"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { hasHistoricProfile, historicStrokes, hullStrokes } from "@/lib/yard/ghost";
import { benchModelBox, benchView, boxCorners, fitBench, type Rect } from "@/lib/yard/benchFrame";
import { stepInstanceIds } from "@/lib/yard/assembly";
import { isFrameRole, isSkinRole } from "@/lib/yard/joints";
import type { DetailLevel, Vec3, WorkMode, YardProject } from "@/lib/yard/types";
import { WalkRig } from "@/components/workspace/walk-rig";
import { StickCloud, PanelMesh, CarcaseJoins } from "@/components/workspace/stick-cloud";
import { AutoCaptureRunner } from "@/components/workspace/auto-capture-runner";

const HULL = "#8a8478";
const BENCH_BG = "#1a1612";
/**
 * Fat lines (ghost opening, panel outlines) live on their own layer: the main camera sees them,
 * but the contact-shadow camera does not. Rendered with its depth material a line mesh becomes big
 * solid quads, which drew a hard dark square on the floor.
 */
export const LINE_LAYER = 1;
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
  // Key light from front-left and high, a cool fill from the right, a warm rim from behind:
  // front faces read bright, the side you see from the 3/4 camera sits a step darker, so
  // shelves, dividers and edges separate instead of washing into one flat tone.
  return (
    <>
      <ambientLight intensity={0.12} />
      <hemisphereLight args={["#fff1dc", "#1a140e", fitted ? 0.3 : 0.4]} />
      <directionalLight
        position={[-span * 0.62, Math.max(H * 1.35, 48), span * 0.95]}
        intensity={fitted ? 2.1 : 1.8}
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
      <directionalLight position={[span * 0.9, H * 0.5, span * 0.3]} intensity={fitted ? 0.42 : 0.34} color="#b4c6de" />
      <directionalLight position={[span * 0.2, H * 0.9, -span * 0.9]} intensity={0.3} color="#ffd7a8" />
      <FootprintShadow project={project} />
    </>
  );
}

/** Soft grounding shadow under the model's footprint (from the solved model's box). */
let footprintTex: THREE.CanvasTexture | null = null;
function footprintTexture() {
  if (footprintTex || typeof document === "undefined") return footprintTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.75)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  footprintTex = new THREE.CanvasTexture(c);
  return footprintTex;
}

function FootprintShadow({ project }: { project: YardProject }) {
  const box = useMemo(() => benchModelBox(project), [project]);
  const tex = footprintTexture();
  if (!tex) return null;
  const w = box.maxX - box.minX, d = box.maxZ - box.minZ;
  const pad = Math.max(6, Math.min(w, d) * 0.35);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(box.minX + box.maxX) / 2, 0.02, (box.minZ + box.maxZ) / 2]} renderOrder={1}>
      <planeGeometry args={[w + pad * 2, d + pad * 2]} />
      <meshBasicMaterial map={tex} transparent opacity={0.62} depthWrite={false} color="#000000" />
    </mesh>
  );
}

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
    if (existing?.startsWith("data:image") && existing.length > 800 && last.current === activeStep) {
      return;
    }

    let cancelled = false;
    tries.current = 0;

    function grab() {
      if (cancelled) return;
      tries.current += 1;
      try {
        // The live camera is shifted so the model clears the UI cards; a photo has no cards,
        // so render it centred, then put the shift back.
        const cam = camera as THREE.PerspectiveCamera;
        const view = cam.view ? { ...cam.view } : null;
        if (view?.enabled) {
          cam.clearViewOffset();
        }
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL("image/jpeg", 0.92);
        if (view?.enabled) {
          cam.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX, view.offsetY, view.width, view.height);
          gl.render(scene, camera);
        }
        if (dataUrl?.startsWith("data:image") && dataUrl.length > 1200) {
          attachStepImage(activeStep!, dataUrl);
          last.current = activeStep!;
          return;
        }
      } catch {
        /* canvas may be tainted or disposed */
      }
      if (tries.current < 2) {
        window.setTimeout(grab, 700);
      }
    }

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
      <AutoCaptureRunner />
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
          toneMappingExposure: 0.98,
        }}
        frameloop="always"
        dpr={[1, 1.75]}
        style={{ display: "block", width: "100%", height: "100%" }}
        onCreated={({ camera: cam, gl, scene }) => {
          gl.setClearColor("#1a1612", 1);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.background = new THREE.Color("#1a1612");
          cam.lookAt(0, 14, 0);
          cam.layers.enable(LINE_LAYER);
        }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={["#1a1612"]} />
        <Environment preset="warehouse" environmentIntensity={0.5} background={false} />
        <StudioLights project={project} useShadows={useShadows} />
        {/* Floor: no hard cast shadow (it read as a dark slab); the soft footprint shadow grounds the model. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[6000, 6000]} />
          <meshStandardMaterial color="#231d17" roughness={0.95} metalness={0} />
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
        <CameraRig project={project} preset={camera} stepIds={stepIds} locked={workMode === "walk"} overlayKey={`${measureOpen ? 1 : 0}${activeStep ?? ""}`} />
        {workMode === "walk" && project.traverse && <WalkRig traverse={project.traverse} />}
        <StepCapture />
      </Canvas>
    </div>
  );
}

/** Canvas-relative rects of the UI cards floating over the bench (marked data-bench-overlay). */
function overlayRects(canvas: HTMLCanvasElement): Rect[] {
  const host = canvas.closest("[data-bench-host]") ?? canvas.parentElement?.parentElement?.parentElement;
  if (!host) return [];
  const c = canvas.getBoundingClientRect();
  const out: Rect[] = [];
  host.querySelectorAll<HTMLElement>("[data-bench-overlay]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) === 0) return;
    out.push({ left: r.left - c.left, top: r.top - c.top, right: r.right - c.left, bottom: r.bottom - c.top });
  });
  return out;
}

function CameraRig({
  project, preset, stepIds, locked, overlayKey,
}: {
  project: YardProject;
  preset: "iso" | "front" | "side" | "top";
  stepIds: string[];
  locked: boolean;
  overlayKey: string;
}) {
  const { camera, controls, gl, size, scene } = useThree();
  const projectRef = useRef(project);
  projectRef.current = project;
  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      const cam = camera as THREE.PerspectiveCamera;
      const viewport = { w: size.width, h: size.height };
      if (viewport.w < 10 || viewport.h < 10) return;
      // One framing path for every build: the solved model's box, the free canvas, a 3/4 view.
      const box = benchModelBox(projectRef.current);
      const base = benchView(projectRef.current, box);
      // A shape-template animal faces +x: its front is the face, its side is the profile.
      const faceX = projectRef.current.shape?.classId === "quadruped";
      const view =
        preset === "front"
          ? { azimuthDeg: faceX ? 90 : 0, elevationDeg: 8 }
          : preset === "side"
            ? { azimuthDeg: faceX ? 0.01 : 90, elevationDeg: 8 }
            : preset === "top"
              ? { azimuthDeg: 0.01, elevationDeg: 89 }
              : base;
      const overlays = overlayRects(gl.domElement);
      const frame = fitBench({ box, view, viewport, overlays, fovDeg: cam.fov });
      cam.setViewOffset(viewport.w, viewport.h, frame.viewOffset.x, frame.viewOffset.y, viewport.w, viewport.h);
      cam.near = Math.max(0.1, frame.distance / 200);
      cam.far = frame.distance * 30;
      cam.position.set(...frame.position);
      const tgt = new THREE.Vector3(...frame.target);
      cam.lookAt(tgt);
      cam.updateProjectionMatrix();
      const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void; minDistance?: number; maxDistance?: number } | null;
      if (orbit?.target) {
        orbit.target.copy(tgt);
        orbit.minDistance = Math.max(2, frame.distance * 0.15);
        orbit.maxDistance = frame.distance * 4;
        orbit.update?.();
      }
      // Floor fades into the background well past the model — no hard floor edge.
      const bg = new THREE.Color(BENCH_BG);
      scene.fog = new THREE.Fog(bg, frame.distance * 1.6, frame.distance * 4.2);
      // Live framing report (read by the bench sweep): real camera projection of the model box.
      const pts = boxCorners(box).map(([x, y, z]) => {
        const v = new THREE.Vector3(x, y, z).project(cam);
        return { x: ((v.x + 1) / 2) * viewport.w, y: ((1 - v.y) / 2) * viewport.h };
      });
      (window as unknown as { __yardFrame?: unknown }).__yardFrame = { viewport, safe: frame.safe, overlays, corners: pts, view, preset };
    };
    // Let the overlay cards lay out first, then fit.
    const t1 = window.setTimeout(fit, 60);
    const t2 = window.setTimeout(fit, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // stepIds drive the step card (an overlay), so re-fit when the step changes.
  }, [preset, project.id, project.panels, project.instances.length, project.overall, stepIds.join("|"), camera, controls, locked, size.width, size.height, gl, scene, overlayKey]);
  return null;
}

function GhostLines({ strokes, color }: { strokes: ReturnType<typeof hullStrokes>; color: string }) {
  return (
    <group>
      {strokes.map((s, i) => (
        <Line key={`${color}-${i}`} points={s.points} color={color} lineWidth={s.weight === "main" ? 1.1 : 0.7} transparent opacity={s.weight === "main" ? 0.18 : 0.08} depthWrite={false} layers={LINE_LAYER} />
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
        <Line key={i} points={p} color="#c4b49a" lineWidth={1} transparent opacity={0.38} depthWrite={false} layers={LINE_LAYER} />
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
