/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { slideInches } from "./stockLook";
import type { AssemblyStep, CatalogItem, Panel, YardInstance, YardProject } from "./types";

function dim(p: Panel) {
  return `${round(p.size.width)} × ${round(p.size.height)} × ${round(p.size.depth)}`;
}

function round(n: number) {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(2);
}

function list(panels: Panel[]) {
  return panels.map((p) => `${p.name} (${dim(p)}")`).join("; ");
}

function joinHold(item?: CatalogItem | null) {
  const join = (item?.preferredJoins && item.preferredJoins[0]) || "glue";
  if (join === "glue") return { join, hold: "Wood glue. Hold 30–60 seconds. Wipe squeeze-out. It will not take load until tomorrow." };
  if (join === "solvent") return { join, hold: "Solvent cement is permanent. Dry-fit the whole thing first — you get one shot." };
  if (join === "tape") return { join, hold: "Packing tape, inside and out. Rub every seam so it bonds. Not screws." };
  if (join === "screw") return { join, hold: "Predrill. #8 screws, plus a drop of glue in the joint if a person will sit or stand on it." };
  if (join === "nail") return { join, hold: "Finish nails or brads, plus glue. Predrill near the ends so the board does not split." };
  return { join, hold: `Primary join: ${join}.` };
}

function cutHow(item?: CatalogItem | null) {
  if (!item) return { how: "Cut to the list.", tip: "Label the waste face." };
  if (item.category === "cardboard") {
    return { how: "Utility knife and a straightedge. Score twice, then snap.", tip: "Not a circular saw. A knife follows a drywall T-square." };
  }
  if (item.formFactor === "pipe") {
    return { how: "PVC cutter or a fine hacksaw. Deburr so each end seats in the fitting.", tip: "A ragged end will not bottom out in a slip tee." };
  }
  if (item.category === "craft_wood") {
    return { how: "Snips or a razor on a scrap board.", tip: "One wrong cut wastes a stick. Cut long, then sneak up on the line." };
  }
  if (item.formFactor === "board") {
    return { how: "Hand saw or circular saw. Square every cut. Predrill near the ends — boards split.", tip: "Cedar and 1× split. Predrill." };
  }
  if (item.category === "plastic") {
    return { how: "Sharp snips. Square the cut so tape has a face to grab.", tip: "A crushed straw will not take a joint." };
  }
  return { how: "Circular saw and a straightedge. Face up, label the waste face.", tip: "Support the offcut so it does not break out." };
}

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  if (project.panels.length && !project.instances.length) {
    return uniquePanelSteps(project);
  }
  if (project.instances.length) return uniqueForgeSteps(project);
  return [
    {
      step: 1,
      title: "Empty bench",
      description: "Generate a thing first. These steps are written from the pieces on the bench.",
    },
  ];
}

function uniquePanelSteps(project: YardProject): AssemblyStep[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const { hold } = joinHold(item);
  const tool = cutHow(item);
  const steps: AssemblyStep[] = [];
  let n = 1;
  steps.push({
    step: n++,
    title: `Confirm ${project.name}`,
    description: `${project.overall.width}" × ${project.overall.height}" × ${project.overall.depth}". ${project.notes[0] ?? "Cut to the opening."}`,
    partsUsed: ["*"],
  });
  if (project.panels.length) {
    steps.push({
      step: n++,
      title: `Cut the ${item?.name ?? "sheet"}`,
      description: `${tool.how} ${list(project.panels)}. Label each piece on the waste face.`,
      partsUsed: project.panels.map((p) => p.name),
      tips: tool.tip,
    });
    steps.push({
      step: n++,
      title: "Dry-stack and check square",
      description: `Stand the uprights with the back, no glue. Check both diagonals. ${hold}`,
      partsUsed: project.panels.map((p) => p.name),
    });
    steps.push({
      step: n++,
      title: "Glue the carcase square",
      description: `Glue and fasten. ${hold} Check diagonals again before the glue grabs.`,
      partsUsed: project.panels.map((p) => p.name),
    });
  }
  steps.push({
    step: n,
    title: "Leave the glue overnight",
    description: "Wipe squeeze-out now. Load it tomorrow. Guidance only — not stamped engineering.",
    partsUsed: ["*"],
  });
  return steps;
}

function cutSummary(instances: YardInstance[], itemName: string) {
  const marked = instances.filter((i) => i.cutLength);
  if (marked.length === 0) {
    return `${instances.length} full ${itemName}${instances.length === 1 ? "" : "s"}. Glue. Do not cut.`;
  }
  const full = instances.length - marked.length;
  const lens = [...new Set(marked.map((i) => (i.cutLength ?? 0).toFixed(1)))].slice(0, 8);
  return `${instances.length} pieces of ${itemName}. ${marked.length} marked cuts${
    lens.length ? ` (${lens.map((l) => `${l}"`).join(", ")}${marked.length > 8 ? "…" : ""})` : ""
  }. ${full} stay full stock.`;
}

function uniqueForgeSteps(project: YardProject): AssemblyStep[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const { join, hold } = joinHold(item);
  const tool = cutHow(item);
  const byRole = new Map<string, YardInstance[]>();
  for (const inst of project.instances) {
    const r = inst.role ?? "member";
    const arr = byRole.get(r) ?? [];
    arr.push(inst);
    byRole.set(r, arr);
  }
  const steps: AssemblyStep[] = [];
  let n = 1;
  const marked = project.instances.filter((i) => i.cutLength);
  const whole = !!item && isWholeStock(item) && marked.length === 0;

  steps.push({
    step: n++,
    title: whole ? `Read this ${project.name} before you glue` : `Read this ${project.name} before you cut`,
    description: `${cutSummary(project.instances, item?.name ?? "stock")} Envelope about ${project.overall.width.toFixed(0)}" × ${project.overall.height.toFixed(0)}" × ${project.overall.depth.toFixed(0)}". ${
      project.buildStats
        ? `${project.buildStats.joints} joints · ${project.buildStats.loose} loose · ${project.buildStats.components} cluster${project.buildStats.components === 1 ? "" : "s"}.`
        : ""
    } ${project.notes[0] ?? ""}`,
    tips: "These steps name the pieces on the bench. If a count disagrees with the cut list, trust the cut list.",
    partsUsed: ["*"],
  });

  steps.push({
    step: n++,
    title:
      project.kind === "arch"
        ? "Lay the opening out on the ground"
        : project.kind === "bridge"
          ? "Mark the span and the two abutments"
          : "Lay out the footprint on the bench",
    description:
      project.kind === "arch"
        ? `Tape a rectangle ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}" where the arch will stand. Walk the opening.`
        : project.kind === "bridge"
          ? `The span is about ${project.overall.width.toFixed(1)}". Mark both abutments, then the clear opening. The deck rides on top of the truss; the abutments plant on the ground.`
          : `Tape a rectangle ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}" on the bench. Mark centerlines both ways.`,
    tips: project.kind === "bridge" ? "A crooked abutment line makes a crooked road. Square the ends first." : "A crooked base cannot be fixed later. Square it now.",
  });

  if (whole) {
    steps.push({
      step: n++,
      title: `Do not cut — ${item?.name ?? "stock"}s stay whole`,
      description: `${project.instances.length} full pieces from the pack. Glue them as they come.`,
      tips: "A pack and a bottle of glue is the whole kit. The bench is a gluing diagram, not a cutting diagram.",
      partsUsed: ["*"],
    });
  } else if (marked.length) {
    const groups = new Map<string, number>();
    for (const i of marked) {
      const k = (i.cutLength ?? 0).toFixed(1);
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    const lines = [...groups.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .slice(0, 10)
      .map(([len, c]) => `${c} × ${len}"`)
      .join("; ");
    steps.push({
      step: n++,
      title: "Cut the marked lengths — same size is the same letter",
      description: `${tool.how} ${lines}. Mark A, B, C on the first of each size, then batch the rest.`,
      tips: tool.tip,
    });
  }

  const order = roleScript(project);
  for (const spec of order) {
    const listI = byRole.get(spec.role);
    if (!listI?.length) continue;
    const lens = item
      ? [...new Set(listI.map((i) => toPrimitive(item, i.cutLength).length.toFixed(1)))]
      : [];
    const sample = lens.slice(0, 6).map((l) => `${l}"`).join(", ");
    steps.push({
      step: n++,
      title: `${spec.title} — ${listI.length} ${spec.role}${listI.length === 1 ? "" : "s"}`,
      description: `${listI.length} ${spec.role} members. ${hold} Lengths in this role: ${sample || "full stock"}. ${spec.extra ?? ""} Dry-fit the joint, then join. ${spec.why}`,
      partsUsed: [spec.role],
      tips: spec.why,
    });
  }

  if (project.kind === "pyramid") {
    steps.push({
      step: n++,
      title: "Leave the north doorway open",
      description: "The gap on the north face is the entrance. Do not lace it shut.",
      tips: "Khufu's door is on the north. If you close it, you built a cage.",
    });
  }

  const decks = project.panels.filter((p) => p.type === "deck");
  if (decks.length) {
    const d = decks[0];
    const sheet = getCatalogItem(d.materialId);
    const sameStock = d.materialId === project.primaryMaterialId;
    steps.push({
      step: n++,
      title: sameStock ? "Lay the road from the same stock" : "Lay the road deck",
      description: sameStock
        ? `${d.name}: densified from the same ${sheet?.name ?? "stock"} as the truss — cross-ties and runners, not a foreign sheet.`
        : `${d.name}: ${d.size.width.toFixed(0)}" × ${d.size.depth.toFixed(1)}" of ${sheet?.name ?? "sheet"}. Rest it on the deck rails.`,
      partsUsed: [d.name],
      tips: sameStock ? "Single-stock build: primary + joiner only." : "Sticks alone are a ladder. The sheet is the road.",
    });
  }

  steps.push({
    step: n++,
    title: "Walk the joints",
    description: walkJointsCopy(project.name, join, project.buildStats?.joints),
    tips: `${project.buildStats?.joints ?? "Many"} joints on this build. Work from the base up so you do not lean on wet work.`,
  });

  steps.push({
    step: n,
    title: finishTitle(project),
    description: finishCopy(project, join),
    tips: "Guidance only — not stamped engineering.",
    partsUsed: ["*"],
  });

  return steps;
}

function walkJointsCopy(name: string, join: string, joints?: number) {
  if (join === "screw") return `Snug every screw on ${name}. ${joints ?? "Many"} joints.`;
  if (join === "solvent") return `Every fitting on ${name} should show a witness of cement.`;
  if (join === "tape") return `Rub every taped seam on ${name}. If a corner peels, add a second wrap.`;
  return `Touch every joint on ${name}. A dry joint will open when you lift it.`;
}

function finishTitle(project: YardProject) {
  if (project.kind === "furniture") return "Cure overnight, then sit on it";
  if (project.kind === "ladder") return "Cure, then stand it up — don't climb it yet";
  if (project.kind === "arch") return "Cure, then walk through it";
  if (project.kind === "bridge") return "Cure, then set it across the gap";
  if (project.kind === "figure") return "Stand it up, then look at it from across the room";
  return "Cure overnight, then pick it up by the base";
}

function finishCopy(project: YardProject, join: string) {
  if (project.kind === "furniture") {
    return `Do not sit on ${project.name} until the joints have cured. If it rocks, shave the long leg — do not twist the rack.`;
  }
  if (project.kind === "ladder") {
    return `Stand ${project.name} against a wall. Do not climb it until every rung is snug.`;
  }
  if (project.kind === "arch") {
    return `Walk through ${project.name}. If a leg kicks out, the footprint was not square.`;
  }
  if (project.kind === "bridge") {
    return `Set ${project.name} on two supports at the abutments. Sight the top chords — they should not sag. Do not walk it until every diagonal joint has cured.`;
  }
  if (project.kind === "figure") {
    return `Stand ${project.name} up and walk around it. If a limb droops, that joint was dry — add tape or glue and hold it.`;
  }
  return `Do not lift ${project.name} by the tip until the joints have cured. If it rocks, the base was not square — shim, do not twist.`;
}

function roleScript(project: YardProject): { role: string; title: string; why: string; extra?: string }[] {
  const k = project.kind;
  if (k === "ladder") {
    return [
      { role: "leg", title: "Cut and mark the two rails", why: "Both rails the same length. A ladder fails at a split rail." },
      { role: "rail", title: "Screw the rungs", why: "Level every rung. Predrill. The rungs are the thing you stand on." },
      { role: "brace", title: "Add any remaining stretchers", why: "They keep the rails from walking apart." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (k === "furniture" || k === "frame") {
    return [
      { role: "base", title: "Screw the stretchers that sit on the floor", why: "The seat sits on this. Square it or the piece rocks." },
      { role: "leg", title: "Stand the legs — two sides first", why: "Each side is a front leg, a back leg, and a side rail. Then join the sides." },
      { role: "rail", title: "Seat rails, slats, and stretchers", why: "Aprons keep the legs from walking apart. Predrill so the stock does not split." },
      { role: "brace", title: "Backrest", why: "The back, not bay lacing. Dry-fit between the rear legs, then screw." },
      { role: "member", title: "Place remaining members", why: "Anything without a role still has to meet a joint." },
    ];
  }
  if (k === "arch") {
    return [
      { role: "leg", title: "Stand the posts in the slip fittings", why: "Posts go in dry. Check you can walk through before any cement." },
      { role: "support", title: "Set the two crowns", why: "Each crown is one shop-length bend. Dry-fit both before any solvent." },
      { role: "rail", title: "Side rails — not across the opening", why: "Rails on the sides only. An X in the opening makes a fence, not an arch." },
      { role: "brace", title: "Last braces, still clear of the portal", why: "Only if they do not close the walk-through." },
      { role: "member", title: "Place remaining members", why: "No floating pipe." },
    ];
  }
  if (k === "figure" || k === "vehicle") {
    return [
      { role: "leg", title: "Build the legs / lower limbs", why: "Two sides that stand. Same length, or it limps." },
      { role: "rail", title: "Torso and arms", why: "The body sits on the legs. Arms last so you can still stand it up." },
      { role: "brace", title: "Joints and details", why: "Tape or glue the crossings." },
      { role: "tip", title: "Head / cap", why: "Last piece. Do not lean on wet tape." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (k === "bridge") {
    return [
      { role: "base", title: "Plant the abutments", why: "Each end sits on the ground. Everything else hangs between them.", extra: "Square the two abutment lines." },
      { role: "support", title: "Set the bottom chords", why: "Lower chords carry the span. Dry-fit both truss planes before glue." },
      { role: "leg", title: "Raise the verticals", why: "Verticals define the bays. Keep them plumb on both faces." },
      { role: "brace", title: "Lace the Warren diagonals", why: "Zigzag diagonals are the truss. Ends meet at joint nodes — no stick through another.", extra: "Work both faces." },
      { role: "rail", title: "Close the top chords and deck rails", why: "Top chords finish the truss. Deck rails become the road bed." },
      { role: "splice", title: "Lap the long splices", why: "Overlap at least ¾ of a stick width and glue both faces." },
      { role: "member", title: "Place remaining members", why: "No floating pieces across the span." },
    ];
  }
  return [
    { role: "base", title: "Dry-fit the base, then glue it", why: "Everything above sits on this. If the base is a parallelogram, the tower leans.", extra: "Check both diagonals within 1/16\"." },
    { role: "support", title: "Stand the arches and pier props first", why: "These take the splay and thrust until the first platform is closed." },
    { role: "leg", title: "Raise the legs, one bay at a time", why: "Glue only as high as you can still reach the joints. Ends meet at the nodes — no stick through another." },
    { role: "ring", title: "Close the platforms and belts", why: "A closed deck on every story stops the legs from walking apart." },
    { role: "rail", title: "Set rails and platform decks", why: "Rails and deck members are diaphragms." },
    { role: "brace", title: "Lace every open bay", why: "The frame will rack without this. Crossings are real joints — ends meet, they do not pierce.", extra: "Work around the tower, not up one face." },
    { role: "splice", title: "Lap the splices", why: "Overlap at least ¾ of a stick width and glue both faces." },
    { role: "tip", title: "Cap the tip / lantern", why: "Support the shaft before you lean on it." },
    { role: "member", title: "Place remaining members", why: "Anything without a role still has to meet a joint. No floating pieces." },
  ];
}
