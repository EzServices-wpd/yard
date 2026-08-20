"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { TraversePath } from "@/lib/yard/types";

const held = new Set<string>();
const GAME = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

export function holdWalkKey(code: string, down: boolean) {
  if (down) held.add(code);
  else held.delete(code);
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getPosition: () => { x: number; y: number; z: number };
      setKeys?: (codes: string[]) => void;
    };
  }
}

/**
 * FPS on-foot along the deck / portal.
 * W = +forward, S = −forward, D = +right, A = −right (strafe, not steer).
 * Mouse: yaw -= movementX, pitch -= movementY. Movement uses yaw only.
 */
export function WalkRig({ traverse }: { traverse: TraversePath }) {
  const { camera, gl } = useThree();
  const yaw = useRef(Math.atan2(-traverse.axis.x, -traverse.axis.z));
  const pitch = useRef(0.28);
  const pos = useRef(new THREE.Vector3(traverse.origin.x, traverse.y, traverse.origin.z));
  const speed = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    yaw.current = Math.atan2(-traverse.axis.x, -traverse.axis.z);
    pitch.current = 0.28;
    pos.current.set(traverse.origin.x, traverse.y, traverse.origin.z);
    speed.current = 0;
  }, [traverse.origin.x, traverse.origin.z, traverse.axis.x, traverse.axis.z, traverse.y]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const prevFov = cam.fov;
    const prevNear = cam.near;
    cam.fov = 70;
    cam.near = 0.08;
    cam.updateProjectionMatrix();
    return () => {
      cam.fov = prevFov;
      cam.near = prevNear;
      cam.updateProjectionMatrix();
    };
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (GAME.has(e.code)) {
        held.add(e.code);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.code);
    };
    const clear = () => held.clear();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * 0.0022;
      pitch.current -= e.movementY * 0.0022;
      const lim = Math.PI / 2 - 0.02;
      pitch.current = Math.max(-lim, Math.min(lim, pitch.current));
    };
    const onClick = () => {
      if (document.pointerLockElement === el) return;
      try {
        const req = el.requestPointerLock as (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
        const p = req.call(el, { unadjustedMovement: true });
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as Promise<void>).catch(() => {
            el.requestPointerLock();
          });
        }
      } catch {
        el.requestPointerLock();
      }
    };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPtrDown = (e: PointerEvent) => {
      if (document.pointerLockElement === el) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPtrMove = (e: PointerEvent) => {
      if (!dragging || document.pointerLockElement === el) return;
      yaw.current -= (e.clientX - lastX) * 0.004;
      pitch.current -= (e.clientY - lastY) * 0.004;
      const lim = Math.PI / 2 - 0.02;
      pitch.current = Math.max(-lim, Math.min(lim, pitch.current));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPtrUp = () => {
      dragging = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clear();
    });
    document.addEventListener("mousemove", onMouseMove);
    el.addEventListener("click", onClick);
    el.addEventListener("pointerdown", onPtrDown);
    window.addEventListener("pointermove", onPtrMove);
    window.addEventListener("pointerup", onPtrUp);
    window.addEventListener("pointercancel", onPtrUp);

    const probe = {
      getYaw: () => yaw.current,
      getSpeed: () => speed.current,
      getPosition: () => ({ x: pos.current.x, y: pos.current.y, z: pos.current.z }),
      setKeys: (codes: string[]) => {
        held.clear();
        for (const c of codes) held.add(c);
      },
    };
    window.__controlsTest = probe;

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("click", onClick);
      el.removeEventListener("pointerdown", onPtrDown);
      window.removeEventListener("pointermove", onPtrMove);
      window.removeEventListener("pointerup", onPtrUp);
      window.removeEventListener("pointercancel", onPtrUp);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      if (document.pointerLockElement === el) document.exitPointerLock();
      el.style.touchAction = "";
      held.clear();
    };
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const axis = traverse.axis;
    const alen = Math.hypot(axis.x, axis.z) || 1;
    const ax = axis.x / alen;
    const az = axis.z / alen;
    const fwdX = -Math.sin(yaw.current);
    const fwdZ = -Math.cos(yaw.current);
    const rightX = Math.cos(yaw.current);
    const rightZ = -Math.sin(yaw.current);

    let mx = 0;
    let mz = 0;
    if (held.has("KeyW") || held.has("ArrowUp")) mz += 1;
    if (held.has("KeyS") || held.has("ArrowDown")) mz -= 1;
    if (held.has("KeyD") || held.has("ArrowRight")) mx += 1;
    if (held.has("KeyA") || held.has("ArrowLeft")) mx -= 1;
    const mag = Math.hypot(mx, mz);
    if (mag > 0) {
      mx /= mag;
      mz /= mag;
    }
    const sprint = held.has("ShiftLeft") || held.has("ShiftRight") ? 1.7 : 1;
    const pace = Math.max(5.5, traverse.length * 0.16) * sprint;
    const moving = mag > 0.01;
    speed.current = moving ? pace : 0;

    if (moving) {
      pos.current.x += (fwdX * mz + rightX * mx) * pace * dt;
      pos.current.z += (fwdZ * mz + rightZ * mx) * pace * dt;
    }

    const ox = traverse.origin.x;
    const oz = traverse.origin.z;
    let s = (pos.current.x - ox) * ax + (pos.current.z - oz) * az;
    const rx = -az;
    const rz = ax;
    let lat = (pos.current.x - ox) * rx + (pos.current.z - oz) * rz;
    s = Math.max(0, Math.min(traverse.length, s));
    const half = traverse.width * 0.42;
    lat = Math.max(-half, Math.min(half, lat));
    pos.current.x = ox + ax * s + rx * lat;
    pos.current.z = oz + az * s + rz * lat;
    pos.current.y = traverse.y;

    euler.current.set(pitch.current, yaw.current, 0, "YXZ");
    camera.position.set(pos.current.x, pos.current.y + traverse.eyeH, pos.current.z);
    camera.quaternion.setFromEuler(euler.current);
  });

  return null;
}
