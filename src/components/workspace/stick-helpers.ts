import * as THREE from "three";
import type { Vec3, WorkMode, YardInstance } from "@/lib/yard/types";
import type { PrimitiveDims } from "@/lib/yard/geometry";
import { pilePosition } from "@/lib/yard/assembly";

export function makeFlatBarGeometry(): THREE.BufferGeometry {
  // Unit popsicle: XY is the FACE (length × width), Z is thickness.
  // Rounded ends live on the 3/8" face, not the thin edge.
  const shape = new THREE.Shape();
  const L = 1;
  const W = 1;
  const R = 0.5;
  shape.moveTo(-L / 2 + R, -W / 2);
  shape.lineTo(L / 2 - R, -W / 2);
  shape.absarc(L / 2 - R, 0, R, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-L / 2 + R, W / 2);
  shape.absarc(-L / 2 + R, 0, R, Math.PI / 2, (3 * Math.PI) / 2, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 10,
  });
  geo.translate(0, 0, -0.5);
  geo.computeVertexNormals();
  return geo;
}

let _flatBarGeo: THREE.BufferGeometry | null = null;
export function flatBarGeometry(): THREE.BufferGeometry {
  if (!_flatBarGeo) _flatBarGeo = makeFlatBarGeometry();
  return _flatBarGeo;
}

let _pipeGeos: Map<number, THREE.LatheGeometry> | null = null;
export function pipeGeometry(innerFrac: number): THREE.LatheGeometry {
  if (!_pipeGeos) _pipeGeos = new Map();
  const k = Math.round(Math.min(0.92, Math.max(0.15, innerFrac)) * 100);
  let g = _pipeGeos.get(k);
  if (!g) {
    const inner = (k / 100) * 0.5;
    const pts = [
      new THREE.Vector2(inner, -0.5),
      new THREE.Vector2(0.5, -0.5),
      new THREE.Vector2(0.5, 0.5),
      new THREE.Vector2(inner, 0.5),
    ];
    g = new THREE.LatheGeometry(pts, 24);
    g.computeVertexNormals();
    _pipeGeos.set(k, g);
  }
  return g;
}

export const ROLE_TINT: Record<string, string> = {
  leg: "#e6b45c",
  brace: "#c99648",
  ring: "#f0d08a",
  rail: "#dfc078",
  skin: "#e8d5a3",
  tip: "#f4e2b0",
  splice: "#d4a85a",
  support: "#c4b49a",
  base: "#e0b86a",
};

export const _dir = new THREE.Vector3();
export const _axisY = new THREE.Vector3(0, 1, 0);
export const _axisX = new THREE.Vector3(1, 0, 0);
export const _flip = new THREE.Vector3(0, 0, 1);

export const FIT_CREAM = "#fffaf0";
export const TAPE_KRAFT = "#c4a574";
export const SCREW_HEAD = "#3a342c";

export function spanOf(overall: { width: number; height: number; depth: number }) {
  return Math.max(overall.width, overall.height, overall.depth, 12);
}

export function meshDiameter(prim: PrimitiveDims, cylindrical: boolean) {
  if (cylindrical) return Math.max((prim.radius ?? 0.1) * 2, 0.08);
  return Math.max(prim.width, prim.height, 0.08);
}

export function courseOnEdge(inst: YardInstance, prim: PrimitiveDims) {
  if (prim.width < prim.height * 1.6) return false;
  if (inst.role === "skin") return true;
  if (inst.role !== "brace" && inst.role !== "ring" && inst.role !== "rail") return false;
  if (!inst.from || !inst.to) return false;
  const dy = Math.abs(inst.to.y - inst.from.y);
  const len = Math.hypot(inst.to.x - inst.from.x, inst.to.y - inst.from.y, inst.to.z - inst.from.z);
  return dy < len * 0.2;
}

export function applyMemberPose(
  dummy: THREE.Object3D,
  inst: YardInstance,
  prim: PrimitiveDims,
  cylindrical: boolean,
  explode: number,
  fallback: Vec3,
  rot: Vec3,
  overall: { width: number; height: number; depth: number },
  flatBar = false,
) {
  const from = inst.from;
  const to = inst.to;
  const diameter = meshDiameter(prim, cylindrical);
  const craft = diameter < 0.55;
  const pad = cylindrical
    ? Math.min(diameter * (craft ? 0.1 : 0.14), craft ? 0.28 : 0.55)
    : Math.min(diameter * (craft ? 0.28 : 0.4), craft ? 0.35 : 1.1);

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
    else if (flatBar) dummy.scale.set(length, prim.width, prim.height);
    else if (courseOnEdge(inst, prim)) dummy.scale.set(length, prim.width, prim.height);
    else dummy.scale.set(length, prim.height, prim.width);
    return;
  }

  dummy.position.set(fallback.x * explode, fallback.y, fallback.z * explode);
  dummy.quaternion.setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z));
  if (cylindrical) dummy.scale.set(diameter, prim.length, diameter);
  else if (flatBar) dummy.scale.set(prim.length, prim.width, prim.height);
  else dummy.scale.set(prim.length, prim.height, prim.width);
}

export function displayPos(
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
