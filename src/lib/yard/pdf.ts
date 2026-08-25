import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { isoCaption, isoDims, isoFaces, isoMarks, isoViewBox } from "./iso";
import { stepInstanceIds } from "./assembly";
import { nestCutList, type NestSheet } from "./nesting";
import type { AssemblyStep, BuildPlan, YardProject } from "./types";

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const ACCENT: [number, number, number] = [140, 108, 72];
const PAPER: [number, number, number] = [243, 238, 228];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];
const PHOTO_RULE: [number, number, number] = [196, 184, 164];
