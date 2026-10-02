import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

let _vessels: Map<string, THREE.LatheGeometry> | null = null;

/** Unit vessel, height 1, widest radius 0.5, so a diameter×length scale keeps the real inches. */
export function vesselGeometry(kind: "bottle" | "can" | "jar" | "tank" | "tool" | "cup" | "bucket"): THREE.LatheGeometry {
  if (!_vessels) _vessels = new Map();
  const cached = _vessels.get(kind);
  if (cached) return cached;
  const rings: [number, number][] =
    kind === "can"
      ? [
          [0.02, -0.5],
          [0.47, -0.49],
          [0.5, -0.45],
          [0.5, 0.4],
          [0.46, 0.45],
          [0.44, 0.5],
        ]
      : kind === "jar"
        ? [
            [0.02, -0.5],
            [0.46, -0.48],
            [0.5, -0.4],
            [0.5, 0.2],
            [0.36, 0.3],
            [0.32, 0.36],
            [0.4, 0.4],
            [0.4, 0.5],
          ]
        : kind === "tank"
          ? [
              [0.08, -0.5],
              [0.46, -0.48],
              [0.5, -0.4],
              [0.5, 0.28],
              [0.32, 0.38],
              [0.14, 0.43],
              [0.1, 0.5],
            ]
          : kind === "tool"
            ? [
                [0.16, -0.5],
                [0.32, -0.46],
                [0.32, -0.22],
                [0.14, -0.16],
                [0.07, -0.08],
                [0.05, 0.5],
              ]
            : kind === "cup"
              ? [
                  [0.22, -0.5],
                  [0.42, -0.48],
                  [0.48, -0.3],
                  [0.5, 0.42],
                  [0.44, 0.5],
                ]
              : kind === "bucket"
                ? [
                    [0.28, -0.5],
                    [0.36, -0.48],
                    [0.5, 0.42],
                    [0.48, 0.5],
                  ]
                : [
            [0.06, -0.5],
            [0.44, -0.48],
            [0.5, -0.36],
            [0.47, -0.02],
            [0.5, 0.16],
            [0.22, 0.3],
            [0.12, 0.38],
            [0.11, 0.44],
            [0.18, 0.455],
            [0.18, 0.5],
          ];
  const geo = new THREE.LatheGeometry(
    rings.map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  );
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const cap =
      kind === "bottle" ? y > 0.445 : kind === "tool" ? y < -0.16 : kind === "tank" ? y > 0.38 : kind === "jar" ? y > 0.38 : y > 0.42;
    const label = kind === "bottle" && y > -0.22 && y < 0.12;
    colors[i * 3] = cap ? (kind === "jar" ? 0.72 : 0.25) : label ? 0.12 : 1;
    colors[i * 3 + 1] = cap ? (kind === "jar" ? 0.62 : 0.45) : label ? 0.38 : 1;
    colors[i * 3 + 2] = cap ? (kind === "jar" ? 0.28 : 0.62) : label ? 0.72 : 1;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  _vessels.set(kind, geo);
  return geo;
}

let _sawhorse: THREE.BufferGeometry | null = null;
/** Unit sawhorse, length 1 along X, so a stock scale keeps the real inches. */
export function sawhorseGeometry(): THREE.BufferGeometry {
  if (_sawhorse) return _sawhorse;
  const beam = new THREE.BoxGeometry(1, 0.08, 0.1);
  beam.translate(0, 0.4, 0);
  const legAt = (x: number, z: number, lean: number) => {
    const leg = new THREE.BoxGeometry(0.05, 0.82, 0.05);
    leg.translate(0, 0.41, 0);
    leg.rotateZ(lean);
    leg.translate(x, 0, z);
    return leg;
  };
  const geo = mergeGeometries([
    beam,
    legAt(-0.34, 0.14, 0.22),
    legAt(-0.34, -0.14, -0.22),
    legAt(0.34, 0.14, -0.22),
    legAt(0.34, -0.14, 0.22),
  ]);
  if (!geo) return beam;
  geo.computeVertexNormals();
  _sawhorse = geo;
  return geo;
}
let _photoSide: THREE.PlaneGeometry | null = null;
/** The second face of a product photo: length along X, face along Z. */
export function photoSideGeometry(): THREE.PlaneGeometry {
  if (!_photoSide) {
    _photoSide = new THREE.PlaneGeometry(1, 1);
    _photoSide.rotateX(Math.PI / 2);
  }
  return _photoSide;
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
  vessel = false,
) {
  const from = inst.from;
  const to = inst.to;
  const diameter = meshDiameter(prim, cylindrical);
  const craft = diameter < 0.55;
  // Discs and wide cut pieces (a board or sheet part drawn at its own section) draw at their true length.
  const pad = inst.round || (inst.section && Math.max(inst.section.width, inst.section.height) > 2)
    ? 0
    : cylindrical
    ? Math.min(diameter * (craft ? 0.1 : 0.14), craft ? 0.28 : 0.55)
    : Math.min(diameter * (craft ? 0.28 : 0.4), craft ? 0.35 : 1.1);

  if (from && to) {
    _dir.set(to.x - from.x, to.y - from.y, to.z - from.z);
    const span = _dir.length() || 0.01;
    _dir.multiplyScalar(1 / span);
    dummy.position.set(((from.x + to.x) / 2) * explode, (from.y + to.y) / 2, ((from.z + to.z) / 2) * explode);
    const axis = cylindrical ? _axisY : _axisX;
    const dot = axis.dot(_dir);
    if (!cylindrical && inst.face) {
      // Lay flat against the named face: thickness axis on the face normal, width in the face.
      const n = new THREE.Vector3(inst.face.x, inst.face.y, inst.face.z);
      n.addScaledVector(_dir, -n.dot(_dir));
      if (n.lengthSq() > 1e-6) {
        n.normalize();
        const thickAxis = n;
        const widthAxis = new THREE.Vector3().crossVectors(_dir, thickAxis);
        // Scale below maps local Y → prim.height (thickness) for boxes, local Z → thickness for flat bars.
        const m4 = new THREE.Matrix4();
        if (flatBar) m4.makeBasis(_dir, widthAxis.clone().negate(), thickAxis);
        else m4.makeBasis(_dir, thickAxis, widthAxis);
        dummy.quaternion.setFromRotationMatrix(m4);
        const length = span + pad * 2;
        if (flatBar) dummy.scale.set(length, prim.width, prim.height);
        else dummy.scale.set(length, prim.height, prim.width);
        return;
      }
    }
    if (dot < -0.999) dummy.quaternion.setFromAxisAngle(_flip, Math.PI);
    else dummy.quaternion.setFromUnitVectors(axis, _dir);
    const length = span + pad * 2;
    if (vessel) dummy.scale.set(diameter, prim.length, diameter);
    else if (cylindrical) dummy.scale.set(diameter, length, diameter);
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
