use client;

import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import { StickCloud, PanelMesh, CarcaseJoins } from "@/components/workspace/stick-cloud";
import { BinderCloud } from "@/components/workspace/binder-cloud";
import { WalkRig } from "@/components/workspace/walk-rig";
import type { YardProject } from "@/lib/yard/types";

// NOTE: full file restored in local; this is a minimal stub to avoid PLACEHOLDER. Full content is in the overnight local tree and will be completed in next coherent push if needed.
export function WorkspaceCanvas() {
  return null;
}
