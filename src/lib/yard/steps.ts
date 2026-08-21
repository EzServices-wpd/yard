/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
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
    if (isSheetCraft(project)) return uniqueSheetSteps(project);
    return uniqueCarcaseSteps(project);
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

function isSheetCraft(project: YardProject) {
  if (project.fitted || project.pocket || project.kind === "closet" || project.kind === "opening") return false;
  if (project.kind === "castle" || project.kind === "house") return true;
  const item = getCatalogItem(project.primaryMaterialId);
  return item?.category === "cardboard" || (item?.formFactor === "sheet" && item.category !== "sheet_goods");
}

function uniqueCarcaseSteps(project: YardProject): AssemblyStep[] {
  const by = (t: Panel["type"] | Panel["type"][]) =>
    project.panels.filter((p) => (Array.isArray(t) ? t.includes(p.type) : p.type === t));
  const steps: AssemblyStep[] = [];
  let n = 1;
  const sheet = getCatalogItem(project.primaryMaterialId);
  const sheetName = sheet?.name ?? "¾\" plywood";
  const program = project.fitted?.program;
  const anchored = project.assumptions.installMode !== "freestanding";
  const deskish = program === "desk";
  const vanity = program === "vanity";
  const bookcase = program === "bookcase";
  const tool = cutHow(sheet);
  const { hold } = joinHold(sheet);

  if (project.pocket) {
    const p = project.pocket;
    steps.push({
      step: n++,
      title: `Measure this pocket three times — ${project.name}`,
      description: `Back ${p.walls.backWidth}" · left ${p.walls.leftDepth}" at ${p.walls.leftAngleDeg.toFixed(2)}° · right ${p.walls.rightDepth}" at ${p.walls.rightAngleDeg.toFixed(2)}° · ${p.walls.height}" high. Write all three heights. The unit is ${p.unit.width}" × ${p.unit.depth}" × ${p.unit.height}", centered, front parallel to the back. Face clearances: left ${p.leftClear.toFixed(2)}" · right ${p.rightClear.toFixed(2)}". Knee ${p.unit.kneeW}" stays open to the floor.`,
      tips: "The walls are the trapezoid. This box stays a rectangle. If a height disagrees by more than ¼\", use the smallest number.",
      partsUsed: ["*"],
    });
  } else if (project.fitted) {
    const u = project.fitted.unit;
    const who = deskish
      ? "This is a desk. You sit at it."
      : vanity
        ? "This is a vanity. Keep plumbing out of the carcase until the box is standing."
        : bookcase
          ? "This is a bookcase. The shelves take the load, not the back."
          : `${program} — a rectangular carcase.`;
    steps.push({
      step: n++,
      title: `Measure for ${project.name}`,
      description: `${who} ${u.width}" wide × ${u.depth}" deep × ${u.height}" high.${u.counterH ? ` Work surface ${u.counterH}".` : ""}${u.kneeW ? ` Knee ${u.kneeW}" in the middle — that bay stays open to the floor.` : ""}${u.shelfCount ? ` ${u.shelfCount} shelf lines.` : ""} ${anchored ? "Fitted to an opening." : "Freestanding — it does not go into studs."} Measure width, height, and depth in three places. Use the smallest number.`,
      tips: deskish
        ? "A proud baseboard will eat a quarter inch under the toekick. Scribe the kick; do not rack the box."
        : "A proud stud or a baseboard will eat a quarter inch you do not have.",
      partsUsed: ["*"],
    });
  } else {
    steps.push({
      step: n++,
      title: `Confirm ${project.name}`,
      description: `${project.overall.width}" × ${project.overall.height}" × ${project.overall.depth}". ${project.notes[0] ?? "Cut to the opening."}`,
    });
  }

  steps.push({
    step: n++,
    title: anchored
      ? "Find every stud and snap a centerline"
      : `Snap a ${Math.round(project.fitted?.unit.width ?? project.overall.width)}" × ${Math.round(project.fitted?.unit.depth ?? project.overall.depth)}" square on the floor`,
    description: anchored
      ? "Find every stud in the opening. Snap a plumb centerline on the back wall. Mark the finished height. Drywall anchors will not hold this."
      : `Tape a rectangle the size of the footprint. Square the corners. That is the only layout ${project.name} needs — it is not a built-in.`,
    tips: anchored ? "A $12 stud finder and a 4-ft level beat guessing." : "If the rectangle is a parallelogram, the carcase will rock.",
  });

  const uprights = by("upright");
  const backs = by("back");
  const tops = by(["top", "bottom"]);
  if (uprights.length || backs.length || tops.length) {
    steps.push({
      step: n++,
      title: `Cut the ${sheetName}`,
      description: `${tool.how} Uprights first — they set every other length.${uprights.length ? ` ${list(uprights)}.` : ""}${backs.length ? ` Back: ${list(backs)}.` : ""}${tops.length ? ` Top/bottom: ${list(tops)}.` : ""} Label each piece on the waste face.`,
      partsUsed: [...uprights, ...backs, ...tops].map((p) => p.name),
      tips: tool.tip,
    });
    const diag = project.fitted
      ? Math.hypot(project.fitted.unit.width, project.fitted.unit.height).toFixed(2)
      : null;
    steps.push({
      step: n++,
      title: "Dry-stack and check square",
      description: `Stand the uprights with the back, no glue. Check both diagonals${diag ? ` — they should both read about ${diag}"` : ""}. If it is racked now, it will be racked forever. ${hold}`,
      partsUsed: [...uprights, ...backs].map((p) => p.name),
      tips: "A pair of clamps and a framing square beat hope.",
    });
    steps.push({
      step: n++,
      title: "Glue the carcase square",
      description: `Glue and screw uprights to the back. ${hold} Check diagonals again before the glue grabs. Predrill ¾" in from the end grain.`,
      partsUsed: [...uprights, ...backs, ...tops].map((p) => p.name),
      tips: '1¼" screws. Do not countersink so deep that you blow the show face.',
    });
  }

  const divs = by("divider");
  const counters = by("counter");
  const kicks = by("kick");
  if ((deskish || vanity) && (divs.length || counters.length)) {
    if (divs.length) {
      steps.push({
        step: n++,
        title: "Set the knee dividers — leave the middle open",
        description: `${list(divs)}. ${project.fitted?.unit.kneeW ?? 24}" clear between them. No toekick in the knee — that is where ${deskish ? "your knees" : "your knees (and the drain)"} go.${kicks.length ? ` Toekicks only under the drawer banks: ${list(kicks)}.` : ""} Dry-fit a drawer opening before you glue.`,
        partsUsed: [...divs, ...kicks].map((p) => p.name),
        tips: "The open bay is the point of this piece. Do not fill it with a panel.",
      });
    }
    if (counters.length || (deskish && tops.length)) {
      const show = counters.length ? counters : tops.filter((p) => p.type === "top");
      const span = show[0]?.size.width ?? 0;
      steps.push({
        step: n++,
        title: deskish ? "Screw the desktop on last" : "Set the counter last",
        description: `${list(show)}. Even overhang. Screw up from the uprights and dividers so you do not punch the show face. Edge-band the front and both ends — that is the plywood people see.`,
        partsUsed: show.map((p) => p.name),
        tips: span > 48 ? "A 5-ft top wants a front stretcher. Saturday-DIY, not a stamp." : "Check the top is flat before you screw. A cupped sheet stays cupped.",
      });
    }
  } else if (divs.length || counters.length) {
    steps.push({
      step: n++,
      title: counters.length ? "Set dividers and the work surface" : "Set the dividers",
      description: [
        divs.length ? `Dividers: ${list(divs)}. These split the bays — dry-fit the openings before you glue.` : "",
        counters.length ? `Work surface: ${list(counters)}. It sits level even if the floor is not.` : "",
        kicks.length ? `Toekick: ${list(kicks)}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      partsUsed: [...divs, ...counters, ...kicks].map((p) => p.name),
    });
  }

  const drawers = by("drawer");
  if (drawers.length) {
    const sizes = new Map<string, number>();
    for (const d of drawers) sizes.set(dim(d), (sizes.get(dim(d)) ?? 0) + 1);
    const sizeLine = [...sizes.entries()].map(([k, c]) => `${c} × ${k}"`).join("; ");
    const depth = Math.max(...drawers.map((d) => d.size.depth));
    const carcaseD = project.fitted?.unit.depth ?? project.pocket?.unit.depth ?? depth;
    const slide = slideInches(carcaseD);
    const banks = drawers.some((d) => /left|right/i.test(d.name)) ? "two banks" : "one bank";
    steps.push({
      step: n++,
      title: `Build ${drawers.length} drawer boxes — ${banks}`,
      description: `All the same unless the cut list says otherwise: ${sizeLine}. Sides and back from leftover ${sheetName}. Bottoms ¼" sitting in a dado, or glued onto a ¼" rabbet. Do not attach the false fronts yet. A box that is square slides; a box that is racked binds.`,
      partsUsed: drawers.map((d) => d.name),
      tips: "Build one, check it in the opening, then batch the rest.",
    });
    steps.push({
      step: n++,
      title: `Hang ${slide}" slides, then the boxes`,
      description: `${drawers.length} pairs of ${slide}" side-mount slides. Screw the cabinet members to the dividers first, inset about 1/32" from the front. Then the box members. Do not glue the slides. Cycle each drawer twice before you hang the next.`,
      partsUsed: drawers.map((d) => d.name),
      tips: `Carcase is ${carcaseD}" deep — buy ${slide}" slides, not 16" by habit.`,
    });
    steps.push({
      step: n++,
      title: "False fronts and pulls",
      description: `False fronts overlap the opening about ½" all around. One cup pull, centered on each front. Screw from inside the box so you do not punch the show face. Playing-card gap between fronts.`,
      partsUsed: drawers.map((d) => d.name),
    });
  }

  const shelves = by("shelf");
  if (shelves.length) {
    steps.push({
      step: n++,
      title: `Bore shelf pins and set ${shelves.length} ${shelves.length === 1 ? "shelf" : "shelves"}`,
      description: `${list(shelves)}. 5 mm pins, two rows, 1¼" in from the front and the back, same height both sides. Dry-fit the lowest shelf first — if it binds, the box is out of square.`,
      partsUsed: shelves.map((p) => p.name),
      tips: bookcase ? "Books are a heavy load. A 36\" span is the edge of Saturday-DIY without a divider." : undefined,
    });
  }

  const rods = by("rail");
  if (rods.length) {
    steps.push({
      step: n++,
      title: "Set the hanging rod",
      description: `${list(rods)}. Sockets into the uprights, not into the back. Check it is level and will take a loaded hanger.`,
      partsUsed: rods.map((p) => p.name),
    });
  }

  const doors = by("door");
  if (doors.length) {
    steps.push({
      step: n++,
      title: doors.length === 1 ? `Hang the door — ${doors[0].name}` : `Hang ${doors.length} doors`,
      description: `${list(doors)}. Two hinges each. Set the reveal even with a playing card. Adjust after the box is standing in its final place.`,
      partsUsed: doors.map((d) => d.name),
    });
  }

  const mirrors = by("mirror");
  if (mirrors.length) {
    steps.push({
      step: n++,
      title: "Hang the mirror",
      description: `${list(mirrors)}. Center it on the knee bay, between the counter and the uppers. Use proper mirror clips or a french cleat — not command strips.`,
      partsUsed: mirrors.map((p) => p.name),
    });
  }

  if (deskish) {
    steps.push({
      step: n++,
      title: "Level it, load a drawer, sit down",
      description: `Level ${project.name} front-to-back and side-to-side. The back is already on the bench so the box cannot rack. Load one drawer with books and cycle it. Then sit. If it rocks, shim a foot — do not twist the rack.`,
      tips: "Not a closet. Do not hang clothes. Do not anchor a freestanding desk to studs unless you want a built-in.",
    });
    steps.push({
      step: n,
      title: "Leave the glue overnight",
      description: "Do not lean on the top or fill the drawers until the glue has cured. Wipe squeeze-out now; it is harder tomorrow.",
    });
  } else if (anchored) {
    steps.push({
      step: n++,
      title: "Shim, then anchor into studs",
      description: `Set the unit on the centerline. Shim the tight side — do not rack the box to match the wall. Fasten the back and both uprights into the studs you marked.${project.pocket ? ` Tight side is ${project.pocket.rightClear < project.pocket.leftClear ? "right" : "left"} (${Math.min(project.pocket.leftClear, project.pocket.rightClear).toFixed(1)}").` : ""}`,
      tips: "Guidance only. Not stamped engineering. Confirm plumbing and studs before you cut.",
    });
    steps.push({
      step: n,
      title: "Walk away overnight",
      description: vanity
        ? "Do not load drawers until the glue has cured. Plumbing and the mirror wait until the box is standing and anchored."
        : "Do not hang clothes until the glue has cured. Wipe squeeze-out now; it is harder tomorrow.",
    });
  } else {
    steps.push({
      step: n++,
      title: bookcase ? "Level it and load a shelf" : `Level ${project.name}`,
      description: `Level front-to-back and side-to-side. The back is already on the bench so the box cannot rack.${bookcase ? " Put weight on the longest shelf and watch for bounce. If it is taller than 48\", add an anti-tip strap to a stud." : ""}`,
      tips: "Guidance only. Not stamped engineering.",
    });
    steps.push({
      step: n,
      title: "Leave the glue overnight",
      description: "Wipe squeeze-out now. Load it tomorrow.",
    });
  }

  return steps;
}

function uniqueSheetSteps(project: YardProject): AssemblyStep[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const { join, hold } = joinHold(item);
  const tool = cutHow(item);
  const steps: AssemblyStep[] = [];
  let n = 1;
  const hole = project.panels.flatMap((p) => p.cutouts ?? []);
  const holeNote = hole[0]
    ? hole[0].label === "entrance"
      ? `Entrance ${round(hole[0].width)}" — cut it in the front wall before you assemble.`
      : `Door ${round(hole[0].width)}" × ${round(hole[0].height)}" — cut it in the front wall before you assemble.`
    : "";

  steps.push({
    step: n++,
    title: `Confirm ${project.name}`,
    description: `${Math.round(project.overall.width)}" × ${Math.round(project.overall.depth)}" × ${Math.round(project.overall.height)}". ${project.notes[0] ?? ""} ${holeNote}`.trim(),
    partsUsed: ["*"],
  });
  steps.push({
    step: n++,
    title: "Snap the footprint",
    description: `Tape a rectangle on the bench or the floor: about ${Math.round(project.overall.width)}" × ${Math.round(project.overall.depth)}". Square it. That is the only layout this needs.`,
  });
  steps.push({
    step: n++,
    title: `Cut the ${item?.name ?? "sheet"}`,
    description: `${tool.how} ${list(project.panels)}. ${holeNote || "Cut openings before the box is closed."} Label the inside face.`,
    partsUsed: project.panels.map((p) => p.name),
    tips: tool.tip,
  });
  if (hole.length) {
    steps.push({
      step: n++,
      title: hole[0].label === "entrance" ? "Cut the entrance hole" : "Cut the door opening",
      description: hole
        .map((c) => `${c.label ?? "opening"} ${round(c.width)}" × ${round(c.height)}", bottom at ${round(c.y)}".`)
        .join(" ") + " Cut it now, while the wall is still a flat sheet.",
      partsUsed: project.panels.filter((p) => p.cutouts?.length).map((p) => p.name),
      tips:
        hole[0].label === "entrance"
          ? "A 1½\" hole is a wren; 1¼\" is a chickadee. Drill, then clean the edge so it does not splinter."
          : "Leave a sill if you want a door later. For a castle, the opening is the door.",
    });
  }
  steps.push({
    step: n++,
    title: join === "tape" ? "Tape the four walls to the floor" : "Join the four walls to the floor",
    description: `${hold} Floor first, then walls. Check both diagonals before the last wall goes on.`,
    partsUsed: project.panels.filter((p) => p.type === "upright" || p.type === "bottom" || p.type === "back").map((p) => p.name),
  });
  const roof = project.panels.filter((p) => p.type === "top" || /roof|keep/i.test(p.name));
  if (roof.length) {
    steps.push({
      step: n++,
      title: project.kind === "castle" ? "Roof, then the keeps" : "Set the roof",
      description: `${list(roof)}. Overhang the walls so rain (or a kid with a hose) does not sit on the joint. ${hold}`,
      partsUsed: roof.map((p) => p.name),
    });
  }
  steps.push({
    step: n,
    title: join === "tape" ? "Rub every seam, then wait an hour" : "Let the joints set, then stand it up",
    description:
      project.kind === "house" && /bird/i.test(project.name)
        ? "Drain holes in the floor. Hang it 5–10 ft up, entrance away from the worst weather. Do not paint the inside."
        : `${project.name} is done when it stands square and the opening still reads as a door. Do not load it like a shelf.`,
    tips: "Guidance only — not stamped engineering.",
    partsUsed: ["*"],
  });
  return steps;
}

function cutSummary(instances: YardInstance[], itemName: string) {
  const marked = instances.filter((i) => i.cutLength);
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

  steps.push({
    step: n++,
    title: `Read this ${project.name} before you cut`,
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
    title: project.kind === "arch" ? "Lay the opening out on the ground" : "Lay out the footprint on the bench",
    description:
      project.kind === "arch"
        ? `Tape a rectangle ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}" where the arch will stand. Walk the opening. If you have to turn sideways, the width is wrong — stop and recut the crown.`
        : `Tape a rectangle ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}" on the bench. That is the base. Mark centerlines both ways so the first joints land where the drawing says.`,
    tips: "A crooked base cannot be fixed later. Square it now.",
  });

  const marked = project.instances.filter((i) => i.cutLength);
  if (marked.length) {
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
      title: `Cut the marked lengths — ${marked.length} cuts`,
      description: `${tool.how} ${lines}. Cut one, check it against the next piece in that role, then batch the rest. Keep offcuts longer than 1" — they become gussets.`,
      tips: tool.tip,
    });
  } else {
    steps.push({
      step: n++,
      title: "Sort full-length stock by role",
      description: "Most members are full stock. Stack legs, rails, and braces in three piles so you do not grab a brace when you need a chord.",
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

  if (project.supportOffer?.needed && !project.supportOffer.included) {
    steps.push({
      step: n++,
      title: "Decide on a spine",
      description: project.supportOffer.reason,
      tips: "The armature is already built. A spine is extra. Generate again with a spine if you want it.",
    });
  }

  if (project.kind === "pyramid") {
    steps.push({
      step: n++,
      title: "Leave the north doorway open",
      description:
        "The gap on the north face is the entrance. Do not lace it shut. Dry-fit the jambs plumb, then glue the lintel. Pack remaining courses on edge at stick width — Fill on the bench is the finished tomb.",
      tips: "Khufu's door is on the north. If you close it, you built a cage.",
    });
    const skinN = project.instances.filter((i) => i.role === "skin").length;
    if (skinN > 0) {
      steps.push({
        step: n++,
        title: "Pack the faces",
        description: `${skinN} face sticks, laid on edge at stock width. Glue each square course to the four hips. Frame is the skeleton, Full is every structural belt, Fill is this packed skin.`,
        tips: "Work from the base up. Keep the north door clear as you pack.",
      });
    }
  }

  const decks = project.panels.filter((p) => p.type === "deck");
  if (decks.length) {
    const d = decks[0];
    const sheet = getCatalogItem(d.materialId);
    steps.push({
      step: n++,
      title: "Lay the road deck",
      description: `${d.name}: ${d.size.width.toFixed(0)}" × ${d.size.depth.toFixed(1)}" of ${sheet?.name ?? "sheet"}. Cut it to the span and rest it on the deck rails. This is the surface you walk — Frame hides it; Full is the thing in use.`,
      partsUsed: [d.name],
      tips: "Sticks alone are a ladder. The sheet is the road. Don't skip it.",
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
    tips: project.notes.find((note) => /slender|rack|fail|anchor/i.test(note)) ?? "Guidance only — not stamped engineering.",
    partsUsed: ["*"],
  });

  return steps;
}

function walkJointsCopy(name: string, join: string, joints?: number) {
  if (join === "screw") {
    return `Snug every screw on ${name}. A spinning screw is a stripped hole — back it out, glue in a toothpick, try again. ${joints ?? "Many"} joints.`;
  }
  if (join === "solvent") {
    return `Every fitting on ${name} should show a witness of cement. A dry socket will slip when you walk through.`;
  }
  if (join === "tape") {
    return `Rub every taped seam on ${name}. If a corner peels, add a second wrap.`;
  }
  return `Touch every joint on ${name}. A dry joint will open when you lift it. Add a drop of glue where two pieces only kiss.`;
}

function finishTitle(project: YardProject) {
  if (project.kind === "furniture") return "Cure overnight, then sit on it";
  if (project.kind === "ladder") return "Cure, then stand it up — don't climb it yet";
  if (project.kind === "arch") return "Cure, then walk through it";
  if (project.kind === "figure") return "Stand it up, then look at it from across the room";
  return "Cure overnight, then pick it up by the base";
}

function finishCopy(project: YardProject, join: string) {
  if (project.kind === "furniture") {
    return `Do not sit on ${project.name} until the joints have cured. Set it on a flat floor. If it rocks, the legs are not the same length — shave the long one, do not twist the rack.`;
  }
  if (project.kind === "ladder") {
    return `Stand ${project.name} against a wall. Sight the rails — they should not bow. Do not climb it until every rung screw is snug.${join === "glue" ? " Glue wants overnight." : ""}`;
  }
  if (project.kind === "arch") {
    return `Walk through ${project.name}. If a leg kicks out, the footprint was not square. Solvent is cured enough to handle in an hour, full strength overnight.`;
  }
  if (project.kind === "figure") {
    return `Stand ${project.name} up and walk around it. If a limb droops, that joint was dry — add tape or glue and hold it.`;
  }
  return `Do not lift ${project.name} by the tip until the joints have cured. Set it on a flat table and look for daylight under a foot. If it rocks, the base was not square — shim, do not twist.`;
}

function roleScript(project: YardProject): { role: string; title: string; why: string; extra?: string }[] {
  const k = project.kind;
  if (k === "ladder") {
    return [
      { role: "leg", title: "Cut and mark the two rails", why: "Both rails the same length. Mark rung spacing on both before you drill. A ladder fails at a split rail." },
      { role: "rail", title: "Screw the rungs", why: "Level every rung. Predrill. The rungs are the thing you stand on — not decoration." },
      { role: "brace", title: "Add any remaining stretchers", why: "If the bench shows extra members, they keep the rails from walking apart." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (k === "furniture" || k === "frame") {
    return [
      { role: "base", title: "Screw the stretchers that sit on the floor", why: "The seat sits on this. Square it or the piece rocks." },
      { role: "leg", title: "Stand the legs — two sides first", why: "Each side is a front leg, a back leg, and a side rail. Then join the sides. Count the cut list, not a picture of four legs." },
      { role: "rail", title: "Seat rails, slats, and stretchers", why: "Aprons keep the legs from walking apart. Slats are the seat. Predrill so the stock does not split." },
      { role: "brace", title: "Backrest", why: "The back, not bay lacing. Dry-fit between the rear legs, then screw." },
      { role: "support", title: "Any extra props", why: "If the bench shows props, they go in now." },
      { role: "member", title: "Place remaining members", why: "Anything without a role still has to meet a joint." },
    ];
  }
  if (k === "arch") {
    return [
      { role: "leg", title: "Stand the posts in the slip fittings", why: "Posts go in dry. Check you can walk through the opening before any cement." },
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
      { role: "brace", title: "Joints and details", why: "Tape or glue the crossings. It reads as the thing when the head is on." },
      { role: "tip", title: "Head / cap", why: "Last piece. Do not lean on wet tape." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  return [
    {
      role: "base",
      title: "Dry-fit the base, then glue it",
      why: "Everything above sits on this. If the base is a parallelogram, the tower leans.",
      extra: "Check both diagonals. They must match within 1/16\".",
    },
    {
      role: "support",
      title: "Stand the arches and props",
      why: "These take the splay / thrust until the first deck is laced. Do not skip them to 'save sticks.'",
    },
    {
      role: "leg",
      title: "Raise the legs, one bay at a time",
      why: "A bay is the space between two stories. Glue only as high as you can still reach the joints.",
      extra: "Sight the four corners. They should taper together, not wander.",
    },
    {
      role: "ring",
      title: "Close the hoops — decks and belts only",
      why: "A hoop on every story makes stacked floors. Only the decks and the belts you already have should be closed.",
    },
    {
      role: "rail",
      title: "Set rails and platform decks",
      why: "A deck is a diaphragm. It stops the legs from walking apart. Glue the diagonals on the deck too.",
    },
    {
      role: "brace",
      title: "Lace every open bay",
      why: "The frame will rack and fail without this. One diagonal per bay is the minimum; both if the stock is thin.",
      extra: "Work around the tower, not up one face. A single laced face is still a mechanism.",
    },
    {
      role: "splice",
      title: "Lap the splices",
      why: "Where a member is longer than the stick, overlap the joint by at least ¾ of a stick width and glue both faces.",
    },
    {
      role: "tip",
      title: "Cap the tip / lantern",
      why: "The last joints are the easiest to knock off. Support the shaft before you lean on it.",
    },
    {
      role: "member",
      title: "Place remaining members",
      why: "Anything without a role still has to meet a joint. No floating pieces.",
    },
  ];
}
