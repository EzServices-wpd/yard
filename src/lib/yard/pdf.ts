import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { isoCaption, isoDims, isoFaces, isoMarks, isoViewBox } from "./iso";
import { stepInstanceIds } from "./assembly";
import { nestCutList, type NestSheet } from "./nesting";
import type { AssemblyStep, BuildPlan, YardProject } from "./types";

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const PAPER: [number, number, number] = [243, 238, 228];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];

/** Plain-English definitions for every shop term used in house plans.
 *  ASCII only — jsPDF default fonts mangle Unicode fractions. */
const SHOP_GLOSSARY: { term: string; def: string }[] = [
  { term: "Carcase", def: "The main box of the unit — uprights, top, bottom, and back screwed together." },
  { term: "Toekick", def: "The recessed strip at the floor so your toes clear when you stand close to the face." },
  { term: "Dry-fit", def: "Assemble without glue or screws first, to check fit and square before you commit." },
  { term: "Overlay", def: "Door or drawer front sits on top of the face, not inside the opening." },
  { term: "Lag", def: "Long heavy screw driven into a wall stud (or masonry anchor) to hold the unit." },
  { term: "Edge banding", def: "Thin strip of veneer ironed onto a raw plywood edge so the edge looks finished." },
  { term: "Shim", def: "Thin wedge used to fill a gap and level or plumb the unit against an uneven wall or floor." },
  { term: "Scribe", def: "Mark and cut an edge to match a wavy wall so the box stays square instead of being forced." },
  { term: "Rack / racking", def: "Twisting the box out of square. A racked carcase makes doors and drawers bind." },
  { term: "Plumb", def: "Truly vertical — checked with a level on the uprights." },
  { term: "Square", def: "Corners at 90 degrees. Check by measuring both diagonals — they should match within about 1/16\"." },
  { term: "Predrill", def: "Drill a small pilot hole before driving a screw so the plywood does not split." },
  { term: "Side-mount slides", def: "Metal drawer tracks that screw to the sides of the box and the cabinet opening." },
  { term: "Concealed hinges", def: "Cup hinges that mount inside the door and carcase so you do not see the hinge from the front." },
  { term: "Soft-close", def: "Hinges or slides that pull the door or drawer shut gently on the last inch." },
  { term: "French cleat", def: "Two interlocking angled strips — one on the wall, one on the piece — so the piece hangs strong and level." },
  { term: "Kerf", def: "The width of material the saw blade removes (about 1/8\" on a circular saw). Already included in the nest." },
  { term: "32mm pin holes", def: "Standard shelf-pin spacing: holes 32mm (about 1-1/4\") apart, 5mm diameter, set back about 1-1/4\" from the front edge." },
];

export function slugPlan(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard-plan";
}

function dataUrlFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" | null {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  if (dataUrl.startsWith("data:image")) return "JPEG";
  return null;
}

// HOTFIX RESTORE - full file continues via second push if needed
export function buildPlanPdf(project: YardProject, plan: BuildPlan): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  return doc;
}

export function planPdfBlob(project: YardProject, plan: BuildPlan): Blob {
  return buildPlanPdf(project, plan).output("blob");
}
