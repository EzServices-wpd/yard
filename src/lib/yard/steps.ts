/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { slideRole } from "./anatomy";
import type { AssemblyStep, CatalogItem, YardInstance, YardProject } from "./types";

function joinHold(item?: CatalogItem | null) {
  const join = (item?.preferredJoins && item.preferredJoins[0]) || "glue";
  if (join === "glue") return { join, hold: "Wood glue. Hold 30–60 seconds. Wipe squeeze-out. It will not take load until tomorrow." };
  if (join === "tape") return { join, hold: "Masking or packing tape. Wrap both faces." };
  if (join === "zip") return { join, hold: "Zip ties or twist ties. Cinch, then trim." };
  if (join === "screw") return { join, hold: "Predrill. #8 screws, plus a drop of glue in the joint if a person will sit or stand on it." };
  if (join === "nail") return { join, hold: "Finish nails or brads, plus glue. Predrill near the ends so the board does not split." };
  return { join, hold: "Join as the stock wants. Dry-fit first." };
}

function cutHow(item?: CatalogItem | null) {
  if (!item) return { how: "Cut to the list.", tip: "Label the waste face." };
  const ff = item.formFactor;
  if (ff === "pipe" || ff === "tube") {
    return { how: "PVC cutter or a fine hacksaw. Deburr so each end seats in the fitting.", tip: "A ragged end will not bottom out in a slip tee." };
  }
  if (ff === "stick" || item.category === "craft_wood") {
    return { how: "Snips or a razor on a scrap board.", tip: "One wrong cut wastes a stick. Cut long, then sneak up on the line." };
  }
  if (ff === "board" || ff === "lumber") {
    return { how: "Hand saw or circular saw. Square every cut. Predrill near the ends — boards split.", tip: "Cedar and 1× split. Predrill." };
  }
  if (item.category === "plastic") {
    return { how: "Sharp snips. Square the cut so tape has a face to grab.", tip: "A crushed straw will not take a joint." };
  }
  return { how: "Circular saw and a straightedge. Face up, label the waste face.", tip: "Support the offcut so it does not break out." };
}

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  // Paper craft: print map → whole sticks on the lines → glue ends. Never cut.
  if (project.flat && !project.flat.lifted) {
    return uniqueFlatSteps(project);
  }
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

/** 2D paper craft — kids / parents, one sitting, no saw. */
function uniqueFlatSteps(project: YardProject): AssemblyStep[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const name = item?.name ?? "craft sticks";
  const subject = project.flat?.subject ?? project.name;
  const paper =
    project.flat?.paper === "8x10"
      ? '8×10"'
      : project.flat?.paper === "a4"
        ? "A4"
        : project.flat?.paper === "letter-landscape"
          ? "Letter landscape"
          : "Letter";
  const n = project.instances.length;
  const { hold } = joinHold(item);
  const steps: AssemblyStep[] = [];
  let s = 1;

  steps.push({
    step: s++,
    title: `Print the ${subject} map`,
    description: `Download the 2D stock map (SVG) and print it on ${paper} paper at 100% scale. Do not “fit to page.” You will lay full ${name} on these lines.`,
    tips: "The map is a gluing diagram, not a cutting diagram.",
    partsUsed: ["*"],
  });

  steps.push({
    step: s++,
    title: `Count out ${n} whole ${name}`,
    description: `${n} full pieces from the pack. Do not cut any of them. Open the glue.`,
    tips: "A pack and a bottle of glue is the whole kit.",
    partsUsed: ["*"],
  });

  steps.push({
    step: s++,
    title: "Lay sticks on the long lines first",
    description: `Start with the longest edges of the ${subject}. Center each full stick on its printed line so the ends reach the joints.`,
    tips: "Short decorative edges still get a full stick — ends will overlap the neighbors. That overlap is where the glue lives.",
    partsUsed: ["rail"],
  });

  steps.push({
    step: s++,
    title: "Glue every meeting end",
    description: `Where two sticks cross or meet, put a small bead of glue on both faces and hold. ${hold}`,
    tips: "Work from the outline inward. Wipe squeeze-out with a damp finger before it skins.",
    partsUsed: ["rail"],
  });

  steps.push({
    step: s++,
    title: "Fill the remaining lines",
    description: `Keep placing full sticks on every printed segment. Overlaps at corners and crossings are intentional.`,
    tips: "If a stick is short of a joint, shift it — do not cut. The map is approximate for hand work.",
    partsUsed: ["rail"],
  });

  steps.push({
    step: s++,
    title: "Let it dry flat",
    description: `Leave the ${subject} on the paper until the glue skins. Then peel carefully or lift the whole sheet.`,
    tips: "Overnight is safest for wood glue. Tape projects can move sooner.",
  });

  return steps;
}

function uniquePanelSteps(project: YardProject): AssemblyStep[] {
  const p = project.panels[0];
  const item = getCatalogItem(p?.materialId ?? project.primaryMaterialId);
  const tool = cutHow(item);
  return [
    {
      step: 1,
      title: `Cut the ${item?.name ?? "sheet"}`,
      description: `${tool.how} Target about ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}".`,
      tips: tool.tip,
    },
    {
      step: 2,
      title: "Square and label",
      description: "Mark the good face. Square the corners.",
      tips: "A sheet that is out of square fights every joint after this.",
    },
  ];
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
    const r = slideRole(inst.role);
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
    tips: whole
      ? "These steps name the pieces on the bench. If a count disagrees with the stick list, trust the stick list — full pieces, no cuts."
      : "These steps name the pieces on the bench. If a count disagrees with the cut list, trust the cut list.",
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

  steps.push({
    step: n++,
    title: "Check plumb and square",
    description: finishLine(project),
    tips: "A lean now is a lean forever. Brace soft joints before you move the piece.",
  });

  return steps;
}

function finishLine(project: YardProject) {
  if (project.kind === "bridge") {
    return `Walk the deck length. If a bay sags, that joint was dry — add tape or glue and hold it.`;
  }
  if (project.kind === "arch") {
    return `Walk under the crown. If a post kicks, re-square the footprint and re-join the base.`;
  }
  if (project.kind === "tower" || project.kind === "eiffel" || project.kind === "lattice") {
    return `Stand ${project.name} up and walk around it. If a limb droops, that joint was dry — add tape or glue and hold it.`;
  }
  return `Stand it up. Sight the long edges. If something racks, find the soft joint and re-join.`;
}

function roleScript(project: YardProject): { role: string; title: string; why: string; extra?: string }[] {
  if (project.kind === "ladder") {
    return [
      { role: "leg", title: "Cut and mark the two rails", why: "Both rails the same length. A ladder fails at a split rail." },
      { role: "rung", title: "Set the rungs", why: "Even spacing. Dry-fit every rung before glue." },
      { role: "brace", title: "Add the braces", why: "Braces keep the rails from spreading." },
    ];
  }
  if (project.kind === "frame") {
    return [
      { role: "rail", title: "Build the outer frame", why: "Square the corners before the joints set." },
      { role: "stile", title: "Add the stiles", why: "Stiles carry the load into the rails." },
      { role: "brace", title: "Joints and details", why: "Tape or glue the crossings." },
    ];
  }
  if (project.kind === "bridge") {
    return [
      { role: "abutment", title: "Plant the abutments", why: "Abutments take the span into the ground. Square both ends first." },
      { role: "support", title: "Set the bottom chords", why: "Lower chords carry the span. Dry-fit both truss planes before glue." },
      { role: "vertical", title: "Raise the verticals", why: "Verticals set the bay rhythm. Keep them plumb." },
      { role: "brace", title: "Lay the Warren diagonals", why: "Diagonals alternate. Ends meet only at the nodes — no stick through another." },
      { role: "rail", title: "Set the top chords and deck", why: "Top chords close the truss; deck beams ride on top. Same stock only." },
      { role: "splice", title: "Lap the long splices", why: "Overlap at least ¾ of a stick width and glue both faces." },
    ];
  }
  // Default lattice / Eiffel / tower / pyramid / arch
  return [
    { role: "base", title: "Dry-fit the base, then glue it", why: "Everything above sits on this. If the base is a parallelogram, the tower leans.", extra: "Check both diagonals within 1/16\"." },
    { role: "leg", title: "Raise the legs, one bay at a time", why: "Glue only as high as you can still reach the joints. Ends meet at the nodes — no stick through another." },
    { role: "rail", title: "Lace the horizontal rails", why: "Rails lock the legs. Work level by level." },
    { role: "brace", title: "Add the diagonals and web", why: "Diagonals kill racking. Ends meet at nodes only." },
    { role: "platform", title: "Set the platforms", why: "Platforms are rest stops and stiffness rings." },
    { role: "splice", title: "Lap the splices", why: "Overlap at least ¾ of a stick width and glue both faces." },
    { role: "member", title: "Fill remaining members", why: "Anything without a role still has to meet a joint. No floating pieces." },
  ];
}
