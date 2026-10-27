"use client";

import { useCutFocus } from "@/components/workspace/cut-focus";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { parseInch } from "@/lib/yard/inchText";
import { hasHistoricProfile, historicStrokes, hullStrokes } from "@/lib/yard/ghost";
import { benchModelBox, benchView, boxCorners, fitBench } from "@/lib/yard/benchFrame";
import { stepInstanceIds } from "@/lib/yard/assembly";
import { isFrameRole, isSkinRole } from "@/lib/yard/joints";
import type { BuildPlan, DetailLevel, Vec3, WorkMode, YardProject } from "@/lib/yard/types";
import { WalkRig } from "@/components/workspace/walk-rig";
import { StickCloud, PanelMesh, CarcaseJoins } from "@/components/workspace/stick-cloud";
import { buildOrder } from "@/components/workspace/build-order";
import { CALLOUT_MS, CAP_MS, WIRE_MS, easeCam, onRevealSkip, revealState, setReveal, staggerFor } from "@/components/workspace/reveal-clock";
import { AutoCaptureRunner } from "@/components/workspace/auto-capture-runner";
import { ExplodeTestHook } from "@/components/workspace/explode-hook";
import { CLOSE_MS, EXPLODE_MS, easeParts } from "@/components/workspace/explode-layout";
import { explodeClock, solvedVersion, subscribeSolved } from "@/components/workspace/explode-state";
import { ExplodeDriver, explodeView, overlayRects } from "@/components/workspace/explode-driver";
import { fitPoints } from "@/components/workspace/explode-frame";
import { SHOP_GROUND, SHOP_LIGHT, shopKeyPosition } from "@/components/workspace/shop-light";
import { drawerGroupOf, drawerGroups, maxOpenPull } from "@/components/workspace/drawerGroups";
import { ScaleLayer } from "@/components/workspace/scale-ghost";
import { scrubShown, scrubState, scrubTrack, subscribeScrub } from "@/components/workspace/build-scrub";
import { PROP_LAYER, figureBox, useScale } from "@/components/workspace/scale-props";
import { STAGE } from "@/components/workspace/stage-palette";

const HULL = STAGE.ghost;
const BENCH_BG = SHOP_GROUND.bg;
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
  // Shop light (PR 16): a warm lamp low from front-left rakes across grain and cut edges, a cool fill from the
  // right keeps whites and kraft neutral, a warm rim from behind separates the silhouette. Lights only.
  const L = SHOP_LIGHT;
  return (
    <>
      <ambientLight intensity={L.ambient} />
      <hemisphereLight args={[L.hemi.sky, L.hemi.ground, fitted ? L.hemi.fitted : L.hemi.loose]} />
      <directionalLight
        position={shopKeyPosition(span, H)}
        intensity={fitted ? L.key.fitted : L.key.loose}
        color={L.key.color}
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
      <directionalLight position={[span * 0.9, H * 0.5, span * 0.3]} intensity={fitted ? L.fill.fitted : L.fill.loose} color={L.fill.color} />
      <directionalLight position={[span * 0.2, H * 0.9, -span * 0.9]} intensity={L.rim.intensity} color={L.rim.color} />
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
      <meshBasicMaterial map={tex} transparent opacity={SHOP_LIGHT.contact} depthWrite={false} color="#000000" />
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
        // Step photos show the build only: the scale figure and props stay off them (and off the PDF).
        const propsSeen = cam.layers.isEnabled(PROP_LAYER);
        cam.layers.disable(PROP_LAYER);
        gl.render(scene, camera);
        if (propsSeen) cam.layers.enable(PROP_LAYER);
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

/** The bench lighting: drei's "warehouse" preset file (Poly Haven empty_warehouse_01, CC0), served from our own origin. */
export const BENCH_HDRI = "/hdri/empty_warehouse_01_1k.hdr";

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
  const viewNonce = useYard((s) => s.viewNonce);
  const pending = building || grokBusy;
  const scrubbing = useSyncExternalStore(subscribeScrub, () => scrubState().open, () => false);

  const step = plan?.instructions.find((s) => s.step === activeStep) ?? null;
  const stepIds = useMemo(() => (step ? stepInstanceIds(project, step) : []), [step, project]);
  const useShadows = project.instances.length + project.panels.length < 180;
  // No WebGL (a headless or locked-down browser): say what the model is in words, never a blank stage.
  const [noGl, setNoGl] = useState(false);
  useEffect(() => {
    const c = document.createElement("canvas");
    setNoGl(!(c.getContext("webgl2") || c.getContext("webgl")));
  }, []);
  if (noGl) {
    const parts = [...new Set(project.panels.map((p) => p.name.replace(/ \d+$/, "")))];
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm opacity-80" data-yard-no-webgl>
        <p>3D view needs WebGL. {project.name}: {parts.length > 12 ? `${parts.slice(0, 12).join(", ")} and more` : parts.join(", ")}.</p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0"
      role="img"
      aria-label={`3D model of ${project.name}, ${project.panels.length} parts. Drag to turn, pinch or scroll to zoom.`}
      data-yard-orbit="drag-turn pinch-zoom"
      // One finger turns the model and two fingers zoom it; the page itself never scrolls under the bench.
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
    >
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
        // Render only while something moves: orbit, the reveal, the explode tween and the camera glide each
        // ask for frames while they run (walking needs every frame).
        frameloop={workMode === "walk" ? "always" : "demand"}
        // Pixel ratio capped at 1.75 (1.5 on phones, below 820 px).
        dpr={typeof window !== "undefined" && window.innerWidth < 820 ? [1, 1.5] : [1, 1.75]}
        style={{ display: "block", width: "100%", height: "100%" }}
        onCreated={({ camera: cam, gl, scene }) => {
          gl.setClearColor(BENCH_BG, 1);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.background = new THREE.Color(BENCH_BG);
          cam.lookAt(0, 14, 0);
          cam.layers.enable(LINE_LAYER);
          cam.layers.enable(PROP_LAYER);
        }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[BENCH_BG]} />
        {/* The HDR preset loads async and suspends; its own boundary keeps that from suspending (hiding) the whole workspace (F43). */}
        <Suspense fallback={null}>
          {/* Self-hosted (drei presets fetch from raw.githack.com at runtime): same CC0 Poly Haven file, public/hdri. */}
          <Environment files={BENCH_HDRI} environmentIntensity={0.5} background={false} />
        </Suspense>
        <StudioLights project={project} useShadows={useShadows} />
        {/* Floor: no hard cast shadow (it read as a dark slab); the soft footprint shadow grounds the model. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[6000, 6000]} />
          <meshStandardMaterial color={SHOP_GROUND.floor} roughness={0.95} metalness={0} />
        </mesh>
        <RevealCamera />
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
          plan={plan}
          stepping={activeStep != null}
        />
        <Grid args={[80, 80]} cellSize={8} cellThickness={0.28} cellColor={SHOP_GROUND.gridCell} sectionSize={24} sectionThickness={0.5} sectionColor={SHOP_GROUND.gridSection} fadeDistance={80} fadeStrength={2.2} infiniteGrid position={[0, 0, 0]} />
        <OrbitControls
          makeDefault
          enabled={workMode !== "walk"}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.9}
          zoomSpeed={0.9}
          minDistance={4}
          maxDistance={480}
          target={[0, 6, 0]}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
        <ScaleLayer project={project} hidden={pending || explode || activeStep != null || workMode === "walk" || scrubbing} />
        <CameraRig project={project} preset={camera} stepIds={stepIds} locked={workMode === "walk"} overlayKey={`${measureOpen ? 1 : 0}${activeStep ?? ""}|${viewNonce}`} />
        {workMode === "walk" && project.traverse && <WalkRig traverse={project.traverse} />}
        <StepCapture />
        <ExplodeTestHook project={project} />
      </Canvas>
    </div>
  );
}

type Glide = {
  from: { pos: THREE.Vector3; tgt: THREE.Vector3; off: [number, number] };
  to: { pos: THREE.Vector3; tgt: THREE.Vector3; off: [number, number]; near: number; far: number; w: number; h: number };
  t0: number;
  dur: number;
};

function CameraRig({
  project, preset, stepIds, locked, overlayKey,
}: {
  project: YardProject;
  preset: "iso" | "front" | "side" | "top";
  stepIds: string[];
  locked: boolean;
  overlayKey: string;
}) {
  const { camera, controls, gl, size, scene, invalidate } = useThree();
  const projectRef = useRef(project);
  projectRef.current = project;
  const presetKey = `${preset}|${overlayKey.split("|").pop() ?? ""}`;
  const lastPresetKey = useRef(presetKey);
  // See inside (item 2): the camera fits the EXPLODED box from 32° up and glides there with the parts.
  const explode = useYard((s) => s.explode);
  const staged = project.panels.length > 0;
  const lastExplode = useRef(explode);
  // A tap's solve can land a little after the tap (it runs in slices, at most 1.5 s): refit when it does.
  const solvedV = useSyncExternalStore(subscribeSolved, solvedVersion, solvedVersion);
  const glide = useRef<Glide | null>(null);
  // Operate on a build with drawers: the cavity camera looks down into the open drawers (Critic #84).
  const facesOpen = useYard((s) => s.facesOpen);
  const soloDrawer = useYard((s) => (s.facesOpen ? drawerGroupOf(s.project.panels, s.selectedId)?.ids[0] ?? null : null));
  const cavityKey = `${facesOpen ? 1 : 0}|${soloDrawer ?? ""}`;
  const lastCavity = useRef(cavityKey);
  const fitRef = useRef<((glideMs?: number) => void) | null>(null);
  // The scale figure stands beside the build: frame it too while it shows (never in See inside).
  const figure = useScale().figure;
  const endGlide = () => { glide.current = null; explodeClock.cameraBusy = false; };
  // Turning, zooming or panning by hand: remember the angle so a rebuild keeps it.
  useEffect(() => {
    const orbit = controls as unknown as (THREE.EventDispatcher<{ start: object; end: object }> & { target?: THREE.Vector3 }) | null;
    if (!orbit?.addEventListener) return;
    const onStart = () => { endGlide(); useYard.getState().setOrbited(true); };
    const onEnd = () => {
      if (!orbit.target) return;
      const d = camera.position.clone().sub(orbit.target);
      if (d.lengthSq() < 1e-6) return;
      d.normalize();
      useYard.getState().setUserView({
        azimuthDeg: (Math.atan2(d.x, d.z) * 180) / Math.PI,
        elevationDeg: Math.max(-80, Math.min(89, (Math.asin(d.y) * 180) / Math.PI)),
      });
    };
    orbit.addEventListener("start", onStart);
    orbit.addEventListener("end", onEnd);
    return () => {
      orbit.removeEventListener("start", onStart);
      orbit.removeEventListener("end", onEnd);
    };
  }, [controls, camera]);
  useFrame(() => {
    const g = glide.current;
    if (!g) return;
    const cam = camera as THREE.PerspectiveCamera;
    const k = Math.min(1, (performance.now() - g.t0) / g.dur);
    const e = easeParts(k);
    const tgt = g.from.tgt.clone().lerp(g.to.tgt, e);
    cam.position.copy(g.from.pos).lerp(g.to.pos, e);
    cam.near = g.to.near; cam.far = Math.max(cam.far, g.to.far);
    cam.setViewOffset(g.to.w, g.to.h, g.from.off[0] + (g.to.off[0] - g.from.off[0]) * e, g.from.off[1] + (g.to.off[1] - g.from.off[1]) * e, g.to.w, g.to.h);
    cam.lookAt(tgt);
    cam.updateProjectionMatrix();
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (orbit?.target) orbit.target.copy(tgt);
    if (k >= 1) { cam.far = g.to.far; cam.updateProjectionMatrix(); orbit?.update?.(); endGlide(); }
    invalidate();
  });
  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    // A preset or Reset view frames the model fresh. A rebuild (new size, new stock) keeps the
    // angle the user turned it to and only refits the distance.
    const asked = lastPresetKey.current !== presetKey;
    lastPresetKey.current = presetKey;
    const st = useYard.getState();
    const kept = !asked && st.orbited ? st.userView : null;
    // See inside on, its solve still running: hold the camera; it glides when the solve lands (solvedV).
    const ready = explodeClock.solved?.key.split("|")[0] === projectRef.current.id;
    if (staged && explode && !ready) return;
    // See inside toggled: glide to the new frame over the explode's own time (reduced motion: jump).
    let toggled = staged && lastExplode.current !== explode;
    lastExplode.current = explode;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = (glideMs = 0) => {
      if (cancelled) return;
      const cam = camera as THREE.PerspectiveCamera;
      const viewport = { w: size.width, h: size.height };
      if (viewport.w < 10 || viewport.h < 10) return;
      // One framing path for every build: the solved model's box, the free canvas, a 3/4 view.
      // Exploded: the exploded box (every part's final pose, with the built box), so condition (d) of
      // every-piece-visible holds by construction: all corners inside the free rect, none under the cards.
      const shut = benchModelBox(projectRef.current);
      // Operate with drawers open: frame the pulled-out drawers too and look down into them from >= 40°.
      const pulled = useYard.getState().facesOpen && !(staged && explode) ? maxOpenPull(projectRef.current.panels, soloDrawer) : 0;
      const cavity = pulled > 0 && drawerGroups(projectRef.current.panels).length > 0;
      const built = cavity ? { ...shut, maxZ: shut.maxZ + pulled } : shut;
      const solved = explodeClock.solved;
      const exploded = staged && explode && !!solved && solved.key.split("|")[0] === projectRef.current.id;
      const box = exploded || stepIds.length || locked ? built : figureBox(built, figure);
      const base = benchView(projectRef.current, shut);
      // A shape-template animal faces +x: its front is the face, its side is the profile.
      const faceX = projectRef.current.shape?.classId === "quadruped";
      const view = kept
        ? kept
        : preset === "front"
          ? { azimuthDeg: faceX ? 90 : 0, elevationDeg: 8 }
          : preset === "side"
            ? { azimuthDeg: faceX ? 0.01 : 90, elevationDeg: 8 }
            : preset === "top"
              ? { azimuthDeg: 0.01, elevationDeg: 89 }
              : exploded ? explodeView() : cavity ? { ...base, elevationDeg: Math.max(base.elevationDeg, 40) } : base;
      const overlays = overlayRects(gl.domElement);
      // Exploded: fit every part's posed corners (and stick members, if any), not one big box: it fills the frame.
      const points = exploded ? [...solved!.points, ...(projectRef.current.instances.length ? boxCorners(built) : [])] : null;
      const frame = points ? fitPoints({ points, view, viewport, overlays, fovDeg: cam.fov }) : fitBench({ box, view, viewport, overlays, fovDeg: cam.fov });
      const tgt = new THREE.Vector3(...frame.target);
      const near = Math.max(0.1, frame.distance / 200), far = frame.distance * 30;
      const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void; minDistance?: number; maxDistance?: number } | null;
      const to = { pos: new THREE.Vector3(...frame.position), tgt, off: [frame.viewOffset.x, frame.viewOffset.y] as [number, number], near, far, w: viewport.w, h: viewport.h };
      const same = cam.position.distanceTo(to.pos) < 1e-3 && !!cam.view && Math.abs(cam.view.offsetX - to.off[0]) + Math.abs(cam.view.offsetY - to.off[1]) < 0.5;
      if (glideMs > 0 && same && !glide.current) return;
      if (glide.current) {
        // A refit while gliding (the cards settled): land on the new frame, same clock.
        glide.current.to = to;
      } else if ((toggled || glideMs > 0) && !reduced && cam.view?.enabled) {
        glide.current = {
          from: { pos: cam.position.clone(), tgt: orbit?.target?.clone() ?? tgt.clone(), off: [cam.view.offsetX, cam.view.offsetY] },
          to, t0: performance.now(), dur: toggled ? (explode ? EXPLODE_MS : CLOSE_MS) : glideMs,
        };
        toggled = false;
        explodeClock.cameraBusy = true;
      } else {
        cam.setViewOffset(viewport.w, viewport.h, frame.viewOffset.x, frame.viewOffset.y, viewport.w, viewport.h);
        cam.near = near;
        cam.far = far;
        cam.position.set(...frame.position);
        cam.lookAt(tgt);
        cam.updateProjectionMatrix();
        if (orbit?.target) {
          orbit.target.copy(tgt);
          orbit.update?.();
        }
      }
      if (orbit) {
        orbit.minDistance = Math.max(2, frame.distance * 0.15);
        orbit.maxDistance = frame.distance * 4;
      }
      // Floor fades into the background well past the model — no hard floor edge.
      const bg = new THREE.Color(BENCH_BG);
      scene.fog = new THREE.Fog(bg, frame.distance * 1.6, frame.distance * 4.2);
      // Live framing report (read by the bench sweep): the framed camera's projection of the model box.
      const probe = cam.clone();
      probe.position.copy(to.pos);
      probe.lookAt(tgt);
      probe.setViewOffset(viewport.w, viewport.h, frame.viewOffset.x, frame.viewOffset.y, viewport.w, viewport.h);
      probe.near = near; probe.far = far;
      probe.updateProjectionMatrix();
      probe.updateMatrixWorld(true);
      const pts = boxCorners(box).map(([x, y, z]) => {
        const v = new THREE.Vector3(x, y, z).project(probe);
        return { x: ((v.x + 1) / 2) * viewport.w, y: ((1 - v.y) / 2) * viewport.h };
      });
      (window as unknown as { __yardFrame?: unknown }).__yardFrame = { viewport, safe: frame.safe, overlays, corners: pts, view, preset, kept: !!kept, exploded };
      // The framed pose, for a reveal glide already running on this camera (see RevealCamera).
      const prev = (cam.userData.framed as FramedPose | undefined)?.v ?? 0;
      cam.userData.framed = { v: prev + 1, pos: to.pos.clone(), target: tgt.clone() } satisfies FramedPose;
      invalidate();
    };
    fitRef.current = fit;
    const cavityChanged = lastCavity.current !== cavityKey;
    lastCavity.current = cavityKey;
    if (cavityChanged && !kept && preset === "iso") {
      fit(reduced ? 0 : 450);
      return () => { cancelled = true; };
    }
    // Fit now, so a remounted Canvas (every rebuild) has a framed camera before its first frame and the
    // reveal glide never starts from the Canvas default; then again once the overlay cards have laid
    // out. On a loaded device those timers land seconds late (setTimeout queues behind the mount).
    fit();
    const t1 = window.setTimeout(() => fit(), 60);
    const t2 = window.setTimeout(() => fit(), 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // stepIds drive the step card (an overlay), so re-fit when the step changes.
  }, [preset, presetKey, project.id, project.panels, project.instances.length, project.overall, stepIds.join("|"), camera, controls, locked, size.width, size.height, gl, scene, overlayKey, explode, staged, invalidate, cavityKey, solvedV, figure, stepIds.length]);
  // While See inside or Operate is on, the free stage follows the cards: opening or closing the
  // tray (More) or a card resizing refits the model with a short glide (the window resizing refits via size), so it never sits
  // under a card or shrinks into a corner (Critic #98 row 106: Operate was fitted with the tray open, then stuck).
  const followsStage = (staged && explode) || facesOpen;
  useEffect(() => {
    if (!followsStage || locked) return;
    const host = gl.domElement.closest("[data-bench-host]");
    if (!host) return;
    let t = 0;
    const kick = () => { window.clearTimeout(t); t = window.setTimeout(() => fitRef.current?.(450), 80); };
    // Every card report refits, the first one included (it lands the glide on the cards' settled sizes in both the
    // animated and the reduced-motion run, so both end on the same camera).
    const ro = new ResizeObserver(kick);
    // The cards are watched here; a window or canvas resize already refits through the main fit (size deps above),
    // and a second, timer-driven refit on resize raced the cards' slide-in on a phone (reduced motion landed elsewhere).
    const watch = () => host.querySelectorAll<HTMLElement>("[data-bench-overlay]").forEach((el) => ro.observe(el));
    watch();
    const mo = new MutationObserver(() => { watch(); kick(); });
    mo.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
    return () => { window.clearTimeout(t); ro.disconnect(); mo.disconnect(); };
  }, [followsStage, locked, gl]);
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
        <Line key={i} points={p} color={STAGE.mark} lineWidth={1} transparent opacity={0.38} depthWrite={false} layers={LINE_LAYER} />
      ))}
    </group>
  );
}

/** A finished build flies together once: parts start exploded and ease home (~0.7s). Still under reduced motion. */
function useAssemble(ready: boolean): number {
  const [k, setK] = useState(1);
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    done.current = true;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const u = Math.min(1, (t - t0) / 700);
      setK(1 + 0.8 * (1 - u) ** 3);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setK(1); };
  }, [ready]);
  return k;
}

/**
 * Build reveal, "blueprint to wood" (UX plan item 1). Once a fresh build lands, every part shows as
 * a faint outline (0–400 ms), then each part turns to wood in step order (60–90 ms apart, compressed
 * past 24 parts), and the camera eases into the 3/4 view over the last 600 ms. The whole thing is
 * capped at 2.4 s. A tap, click or Esc jumps to the finished frame. Reduced motion: no stagger, no
 * camera move, a 150 ms fade on the finished frame. Visibility and material only, no new geometry.
 * Returns the set of parts already in wood (others draw as outlines), or null when nothing plays.
 */
/** Above this many parts the reveal steps by build beat. */
const BEAT_MODE_PARTS = 120;
/** Longest the model waits in outline for its build order (inside the lamp fade). */
const PLAN_WAIT_MS = 350;
const EMPTY_IDS: Set<string> = new Set();

function useStepReveal(project: YardProject, plan: BuildPlan | null | undefined, ready: boolean, stepping: boolean): Set<string> | null {
  const order = useMemo(() => {
    if (!ready || !plan?.instructions.length) return null;
    const { at, n, stale } = buildOrder(project, plan);
    if (n < 2 || stale) return null;
    // Parts in step order (stable within a step: the model's own order).
    const ids = [...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)].filter((id) => at.has(id));
    ids.sort((x, y) => at.get(x)! - at.get(y)!);
    // Cut pieces each mesh stands for (a 5-layer hub is one mesh, five cut pieces), from the plan's own
    // cut rows (partIds), so "k of N" counts what the plan counts. A mesh no row names counts once.
    const weight = new Map<string, number>();
    for (const row of plan.cutList) {
      const own = (row.partIds ?? []).filter((id) => at.has(id));
      if (own.length && row.quantity > own.length) for (const id of own) weight.set(id, Math.max(weight.get(id) ?? 1, row.quantity / own.length));
    }
    const cum = [0];
    for (const id of ids) cum.push(cum[cum.length - 1] + (weight.get(id) ?? 1));
    // Beat ends: index just past the last part of each beat (for big models that step by beat).
    const beatEnds: number[] = [];
    ids.forEach((id, i) => { if (i === ids.length - 1 || at.get(ids[i + 1]) !== at.get(id)) beatEnds.push(i + 1); });
    return { at, n, ids, cum, beatEnds };
  }, [project, plan, ready]);
  const [wood, setWood] = useState<number>(Infinity);
  const played = useRef<string | null>(null);
  const readyAt = useRef<{ id: string; t: number } | null>(null);
  const woodShown = useRef<string | null>(null);
  if (ready && readyAt.current?.id !== project.id) readyAt.current = { id: project.id, t: performance.now() };
  useEffect(() => {
    if (!order || stepping || played.current === project.id) return;
    played.current = project.id;
    const host = document.querySelector("[data-bench-host]");
    const skip = (why: string) => host?.setAttribute("data-yard-reveal", `skip:${why}`);
    // Wood already on screen (the plan came after the model): never hide it again for a reveal.
    if (!readyAt.current || readyAt.current.id !== project.id || woodShown.current === project.id) return skip("late");
    if (document.hidden) return skip("hidden");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      host?.querySelector("canvas")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
      return skip("reduced-motion");
    }
    const total = order.ids.length;
    const count = (k: number) => Math.round(order.cum[Math.min(k, total)]);
    const pieces = count(total);
    // Big models (hundreds of parts) step by build beat, not by part: a handful of renders keeps the
    // 2.4 s cap on any device instead of one re-render of every part per frame.
    const byBeat = total > BEAT_MODE_PARTS;
    const units = byBeat ? order.beatEnds.length : total;
    const stagger = staggerFor(units);
    // The outline phase runs while the lamp fades (no wait for the fade to finish).
    let t0 = Math.max(performance.now() - 16, readyAt.current.t);
    let end = t0 + WIRE_MS + units * stagger + CALLOUT_MS;
    // The wood stepping never runs under a lamp that is still up (not yet fading): the bench is
    // ready when the build settles, but the page's lamp can hold on a beat longer (a first ?q= build
    // waits for the whole prompt run). A short beat-mode reveal used to finish entirely under it.
    const lampUp = () => !!document.querySelector(".yard-lamp[data-yard-building]");
    let raf = 0;
    let shownCount = -1;
    let held = false;
    let shownU = 0;
    const finish = (skipped: boolean) => {
      cancelAnimationFrame(raf);
      setWood(Infinity);
      setReveal({ active: false, wood: pieces, skipped });
      host?.setAttribute("data-yard-reveal", `done/${pieces}`);
      host?.setAttribute("data-yard-reveal-ms", String(Math.round(performance.now() - t0)));
      onRevealSkip(null);
      window.removeEventListener("keydown", onKey);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(true); };
    window.addEventListener("keydown", onKey);
    onRevealSkip(() => finish(true));
    setWood(0);
    setReveal({ active: true, n: pieces, wood: 0, t0, end, skipped: false });
    host?.setAttribute("data-yard-reveal", `wire/${pieces}`);
    host?.setAttribute("data-yard-reveal-mode", byBeat ? "beat" : "part");
    // Step clock. The first wood frame of a model can stall (~1 s on a slow phone or a big model), so
    // the first step is held to one painted frame; then the rest re-spread over what is left of the
    // 2.4 s cap (never slower than the planned stagger). Part mode catches up freely after that, so
    // small builds stay inside the cap; beat mode (a handful of beats) still shows each beat a frame.
    let base = 0;
    let gap = stagger;
    let last = 0;
    const tick = () => {
      const now = performance.now();
      if (lampUp()) {
        t0 = now;
        end = t0 + WIRE_MS + units * stagger + CALLOUT_MS;
        held = true;
        last = 0;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (held) { held = false; setReveal({ t0, end }); }
      // Last frame's length: a step that would land past the cap shows the finished frame instead.
      const frame = last ? Math.min(1000, now - last) : 16;
      last = now;
      let u: number;
      if (shownU === 0) {
        u = now < t0 + WIRE_MS ? 0 : 1;
      } else {
        if (!base) {
          base = now;
          const left = t0 + CAP_MS - CALLOUT_MS - now;
          gap = units > 1 ? Math.max(0, Math.min(stagger, left / (units - 1))) : 0;
          end = Math.max(now, base + (units - 1) * gap) + CALLOUT_MS;
          setReveal({ end });
        }
        const due = gap > 0 ? Math.min(units, 1 + Math.floor((now - base) / gap)) : units;
        u = byBeat ? Math.min(due, shownU + 1) : due;
      }
      // Hard cap: past 2.4 s from the outline the finished frame shows, whatever the device managed.
      if ((now >= end && shownU >= units) || (base > 0 && now + (base < now ? frame : 0) >= t0 + CAP_MS)) return finish(false);
      const k = byBeat ? (u ? order.beatEnds[u - 1] : 0) : u;
      shownU = u;
      if (k !== shownCount) {
        shownCount = k;
        setWood(k);
        setReveal({ wood: count(k) });
        host?.setAttribute("data-yard-reveal", k === 0 ? `wire/${pieces}` : `${count(k)}/${pieces}`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); onRevealSkip(null); setWood(Infinity); setReveal({ active: false }); };
  }, [order, stepping, project.id]);
  // No build order yet when the model is ready (the plan is made just after the model, and under
  // load that can land a few frames late): hold the model in outline for at most PLAN_WAIT_MS, inside
  // the lamp's fade, instead of painting wood the reveal must then skip ("skip:late", Brooklyn 2 of 4).
  // Past that the model shows in wood and that build skips its reveal, as before.
  const lateCandidate = ready && !order && !stepping && played.current !== project.id;
  const [waitedFor, setWaitedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!lateCandidate) return;
    const id = project.id;
    const since = readyAt.current?.id === id ? readyAt.current.t : performance.now();
    let raf = 0;
    const t = window.setTimeout(() => {
      setWaitedFor(id);
      // Only a model that actually painted in wood counts (two frames later).
      raf = requestAnimationFrame(() => requestAnimationFrame(() => { if (played.current !== id) woodShown.current = id; }));
    }, Math.max(0, since + PLAN_WAIT_MS - performance.now()));
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [lateCandidate, project.id]);
  if (lateCandidate && waitedFor !== project.id) return EMPTY_IDS;
  if (!order || wood === Infinity || stepping) return null;
  return new Set(order.ids.slice(0, wood));
}


/**
 * The reveal's camera glide: the view starts a little wide and turned, then eases into the framed
 * 3/4 view over the reveal's last 600 ms (cubic-bezier .2,.7,.2,1). Orbits the controls' target,
 * so the CameraRig's framing is the end pose. Idle when no reveal is running.
 */
/** The pose CameraRig last framed on this camera (kept on the camera, so a remounted Canvas starts empty). */
type FramedPose = { v: number; pos: THREE.Vector3; target: THREE.Vector3 };
function RevealCamera() {
  const { camera, controls, invalidate } = useThree();
  const pose = useRef<{ t0: number; end: number; v: number; from: THREE.Vector3; to: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  useFrame(() => {
    const r = revealState();
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    // frameloop "demand": the reveal keeps frames coming while it runs, and one more to land its end pose.
    if (r.active || pose.current) invalidate();
    if (!r.active) {
      if (pose.current) {
        // End on the latest framing (a fit can land after the last glide frame).
        const latest = camera.userData.framed as FramedPose | undefined;
        camera.position.copy(latest ? latest.pos : pose.current.to);
        if (latest) camera.lookAt(latest.target);
        orbit?.update?.();
        pose.current = null;
      }
      return;
    }
    // The glide ends on the rig's framed pose, never on whatever the camera held when the reveal began.
    // A rebuild (Wider, Taller…) remounts the Canvas and its reveal starts on the first frame, before
    // the rig's first fit (60 ms): capturing the camera then glided to, and left it at, the Canvas
    // default (48, 32, 48), inside the model — dark shelves, then a broken view (hotfix, Oct 16).
    const framed = camera.userData.framed as FramedPose | undefined;
    // No framed pose yet (the rig couldn't fit, e.g. a zero-size canvas): wait for it, never glide to
    // or from the Canvas default.
    if (!framed) return;
    const v = framed.v;
    if (!pose.current || pose.current.t0 !== r.t0 || pose.current.v !== v) {
      const to = framed.pos.clone();
      const target = framed.target.clone();
      const rel = to.clone().sub(target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.18).multiplyScalar(1.08);
      pose.current = { t0: r.t0, end: r.end, v, from: target.clone().add(rel), to, target };
    }
    const p = pose.current;
    const u = easeCam(Math.min(1, Math.max(0, (performance.now() - (p.end - 600)) / 600)));
    const rel0 = p.from.clone().sub(p.target);
    const rel1 = p.to.clone().sub(p.target);
    // Slerp-ish: interpolate the angle around Y and the distance separately so the glide arcs.
    const a0 = Math.atan2(rel0.x, rel0.z), a1 = Math.atan2(rel1.x, rel1.z);
    let da = a1 - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    const a = a0 + da * u;
    const flat0 = Math.hypot(rel0.x, rel0.z), flat1 = Math.hypot(rel1.x, rel1.z);
    const flat = flat0 + (flat1 - flat0) * u;
    const y = rel0.y + (rel1.y - rel0.y) * u;
    camera.position.set(p.target.x + Math.sin(a) * flat, p.target.y + y, p.target.z + Math.cos(a) * flat);
    camera.lookAt(p.target);
  });
  return null;
}

function BenchScene({
  project, explode, facesOpen, selectedId, onSelect, onPlace, showHull, showHistoric, workMode, stepIds, placedIds, lockedIds, dragPos, measureOpen, measure, pending, detail, joinMethod, useShadows, plan, stepping = false,
}: {
  plan?: BuildPlan | null;
  stepping?: boolean;
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
  const assemble = useAssemble(project.panels.length > 0 && !pending);
  const explodeScale = explode ? 1.35 : assemble;
  // See inside on a panel build is the staged unit explode (explode-driver.tsx): panels keep their built
  // place here and the driver moves them. Stick builds keep the spread-out view.
  const staged = project.panels.length > 0;
  const panelScale = staged ? assemble : explodeScale;
  const stepReveal = useStepReveal(project, plan, project.panels.length + project.instances.length > 0 && !pending, stepping);
  // Watch it build (build-scrub.ts): the scrubber's position draws through the reveal's outline/wood path.
  const scrub = useSyncExternalStore(subscribeScrub, scrubState, scrubState);
  const track = useMemo(() => (scrub.open && !pending ? scrubTrack(project, plan) : null), [scrub.open, pending, project, plan]);
  const scrubbed = useMemo(() => (track && !stepping ? scrubShown(track, scrub.k) : null), [track, stepping, scrub.k]);
  const reveal = stepReveal ?? scrubbed;
  const hull = useMemo(() => (showHull ? hullStrokes(project) : []), [showHull, project]);
  const historic = useMemo(() => (showHistoric ? historicStrokes(project) : []), [showHistoric, project]);
  const mw = parseInch(measure.width) || 0;
  const mh = parseInch(measure.height) || 0;
  const md = parseInch(measure.depth) || 0;
  const members =
    detail === "frame"
      ? project.instances.filter((i) => isFrameRole(i.role))
      : detail === "full"
        ? project.instances.filter((i) => !isSkinRole(i.role))
        : project.instances;
  const shownMembers = useMemo(() => (reveal ? members.filter((i) => reveal.has(i.id)) : members), [members, reveal]);
  const showPinHoles = useMemo(
    () => project.panels.some((p) => p.type === "shelf"),
    [project.panels],
  );

  // Cut-list focus (partIds): outline the parts the plan points at, once the reveal is done.
  const cutFocus = useCutFocus();
  const focusOn = !reveal && cutFocus.size > 0;
  return (
    <group>
      {showHull && <GhostLines strokes={hull} color={HULL} />}
      {showHistoric && <GhostLines strokes={historic} color={HIST} />}
      {measureOpen && mw > 0 && mh > 0 && <MeasureGhost width={mw} height={mh} depth={md || 16} />}
      {!pending && (
        <StickCloud
          instances={shownMembers}
          explode={explodeScale}
          selectedId={selectedId}
          workMode={workMode}
          stepIds={focusOn ? [...cutFocus] : stepIds}
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
              explode={panelScale}
              selected={panel.id === selectedId}
              inStep={reveal ? false : focusOn ? cutFocus.has(panel.id) : stepIds.length ? stepIds.includes(panel.id) : false}
              hasStep={reveal ? !reveal.has(panel.id) : focusOn ? false : stepIds.length > 0}
              onSelect={() => onSelect(panel.id)}
              useShadows={useShadows}
              facesOpen={facesOpen && !(staged && explode)}
              showPinHoles={showPinHoles}
            />
          ))}
      {!pending && !reveal && project.panels.length > 0 && (
        <CarcaseJoins panels={project.panels} explode={explodeScale} />
      )}
      {!pending && staged && <ExplodeDriver project={project} explode={explode} />}
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
