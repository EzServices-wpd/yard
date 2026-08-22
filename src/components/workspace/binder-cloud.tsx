"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { binderKind, classifyJoint, jointNodes } from "@/lib/yard/joints";
import { isCylindrical, visualPrimitive } from "@/lib/yard/geometry";
import { getCatalogItem } from "@/lib/yard/catalog";
import {
  FIT_CREAM,
  TAPE_KRAFT,
  SCREW_HEAD,
  meshDiameter,
  _axisY,
  _flip,
} from "@/components/workspace/stick-helpers";
import type { Vec3, YardInstance, YardProject } from "@/lib/yard/types";

type Row = {
  inst: YardInstance;
  prim: ReturnType<typeof visualPrimitive>;
  item: NonNullable<ReturnType<typeof getCatalogItem>>;
};

export function BinderCloud({
  cyls,
  boxes,
  explode,
  joinMethod,
}: {
  cyls: Row[];
  boxes: Row[];
  explode: number;
  joinMethod?: YardProject["joinMethod"];
}) {
  const hubMesh = useRef<THREE.InstancedMesh>(null);
  const bandMesh = useRef<THREE.InstancedMesh>(null);
  const screwMesh = useRef<THREE.InstancedMesh>(null);

  const { hubs, bands, screws } = useMemo(() => {
    const hubs: { p: Vec3; r: number }[] = [];
    const bands: { p: Vec3; dir: Vec3; r: number; length: number }[] = [];
    const screws: { p: Vec3; r: number }[] = [];

    const slipRows = cyls.filter((row) => binderKind(row.item, joinMethod) === "slip");
    const tapeRows = [...cyls, ...boxes].filter((row) => binderKind(row.item, joinMethod) === "tape");
    const fastRows = [...cyls, ...boxes].filter((row) => binderKind(row.item, joinMethod) === "fastener");

    if (slipRows.length) {
      const nodes = jointNodes(
        slipRows.map((row) => ({
          from: row.inst.from,
          to: row.inst.to,
          radius: meshDiameter(row.prim, true) / 2,
        })),
      );
      for (const node of nodes) {
        const kind = classifyJoint(node);
        if (kind === "ground" || kind === "coupling") continue;
        hubs.push({ p: node.p, r: node.r * (kind === "cap" ? 1.12 : 1.42) });
      }
    }

    if (tapeRows.length) {
      const nodes = jointNodes(
        tapeRows.map((row) => ({
          from: row.inst.from,
          to: row.inst.to,
          radius: meshDiameter(row.prim, row.prim.radius != null || isCylindrical(row.item.formFactor)) / 2,
        })),
      );
      for (const node of nodes) {
        if (classifyJoint(node) === "ground" || node.dirs.length < 2) continue;
        const d = node.dirs[0];
        bands.push({ p: node.p, dir: d, r: node.r * 1.45, length: Math.max(node.r * 1.3, 0.18) });
      }
    }

    if (fastRows.length) {
      const nodes = jointNodes(
        fastRows.map((row) => ({
          from: row.inst.from,
          to: row.inst.to,
          radius: meshDiameter(row.prim, row.prim.radius != null || isCylindrical(row.item.formFactor)) / 2,
        })),
      );
      for (const node of nodes) {
        if (classifyJoint(node) === "ground" || node.dirs.length < 2) continue;
        screws.push({ p: node.p, r: Math.max(node.r * 0.55, 0.08) });
      }
    }

    return { hubs, bands, screws };
  }, [cyls, boxes, joinMethod]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    const writeSpheres = (mesh: THREE.InstancedMesh | null, items: { p: Vec3; r: number }[], hex: string) => {
      if (!mesh) return;
      color.set(hex);
      for (let i = 0; i < items.length; i++) {
        dummy.position.set(items[i].p.x * explode, items[i].p.y, items[i].p.z * explode);
        dummy.quaternion.identity();
        dummy.scale.setScalar(items[i].r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.count = items.length;
    };

    const writeCyls = (
      mesh: THREE.InstancedMesh | null,
      items: { p: Vec3; dir: Vec3; r: number; length: number }[],
      hex: string,
    ) => {
      if (!mesh) return;
      color.set(hex);
      for (let i = 0; i < items.length; i++) {
        const s = items[i];
        dummy.position.set(s.p.x * explode, s.p.y, s.p.z * explode);
        const dir = new THREE.Vector3(s.dir.x, s.dir.y, s.dir.z);
        if (_axisY.dot(dir) < -0.999) dummy.quaternion.setFromAxisAngle(_flip, Math.PI);
        else dummy.quaternion.setFromUnitVectors(_axisY, dir);
        dummy.scale.set(s.r * 2, s.length, s.r * 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.count = items.length;
    };

    writeSpheres(hubMesh.current, hubs, FIT_CREAM);
    writeCyls(bandMesh.current, bands, TAPE_KRAFT);
    writeSpheres(screwMesh.current, screws, SCREW_HEAD);
  }, [hubs, bands, screws, explode]);

  return (
    <group>
      {hubs.length > 0 && (
        <instancedMesh ref={hubMesh} args={[undefined, undefined, Math.max(hubs.length, 1)]} frustumCulled={false}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={FIT_CREAM} roughness={0.38} metalness={0.08} />
        </instancedMesh>
      )}
      {bands.length > 0 && (
        <instancedMesh ref={bandMesh} args={[undefined, undefined, Math.max(bands.length, 1)]} frustumCulled={false}>
          <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
          <meshStandardMaterial color={TAPE_KRAFT} roughness={0.72} metalness={0.02} />
        </instancedMesh>
      )}
      {screws.length > 0 && (
        <instancedMesh ref={screwMesh} args={[undefined, undefined, Math.max(screws.length, 1)]} frustumCulled={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color={SCREW_HEAD} roughness={0.4} metalness={0.35} />
        </instancedMesh>
      )}
    </group>
  );
}
