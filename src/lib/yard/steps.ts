/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import type { AssemblyStep, Panel, YardInstance, YardProject } from "./types";

function dim(p: Panel) {
  return `${round(p.size.width)} × ${round(p.size.height)} × ${round(p.size.depth)}`;
}

function round(n: number) {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(2);
}

function list(panels: Panel[]) {
  return panels.map((p) => `${p.name} (${dim(p)}")`).join("; ");
}

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  if (project.panels.length && !project.instances.length) return uniquePanelSteps(project);
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
  const by = (t: Panel["type"] | Panel["type"][]) =>
    project.panels.filter((p) => (Array.isArray(t) ? t.includes(p.type) : p.type === t));
  const steps: AssemblyStep[] = [];
  let n = 1;
  const sheet = "¾\" plywood";

  if (project.pocket) {
    const p = project.pocket;
    steps.push({
      step: n++,
      title: `Measure this pocket three times — ${project.name}`,
      description: `Back ${p.walls.backWidth}" · left ${p.walls.leftDepth}" at ${p.walls.leftAngleDeg.toFixed(2)}° · right ${p.walls.rightDepth}" at ${p.walls.rightAngleDeg.toFixed(2)}° · ${p.walls.height}" high. Write all three heights. The unit is ${p.unit.width}" × ${p.unit.depth}" × ${p.unit.height}", centered, front parallel to the back. Face clearances: left ${p.leftClear.toFixed(2)}" · right ${p.rightClear.toFixed(2)}".`,
      tips: "The walls are the trapezoid. This box stays a rectangle. If a height disagrees by more than ¼\", use the smallest number.",
      partsUsed: ["*"],
    });
  } else if (project.fitted) {
    const u = project.fitted.unit;
    steps.push({
      step: n++,
      title: `Measure the space for ${project.name}`,
      description: `${project.fitted.program} · ${u.width}" wide × ${u.depth}" deep × ${u.height}" high${u.counterH ? ` · work surface ${u.counterH}"` : ""}${u.kneeW ? ` · knee ${u.kneeW}"` : ""}${u.shelfCount ? ` · ${u.shelfCount} shelf lines` : ""}. ${project.fitted.opening.kind === "alcove" ? "Fitted to an opening." : "Freestanding carcase."} Measure width, height, and depth in three places.`,
      tips: "Use the smallest number. A proud stud or a baseboard will eat a quarter inch you do not have.",
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
    title: "Mark studs and a centerline",
    description:
      project.assumptions.installMode === "freestanding"
        ? "Snap a square on the floor the size of the footprint. That is the only layout this unit needs."
        : "Find every stud in the opening. Snap a plumb centerline on the back wall. Mark the finished height. Drywall anchors will not hold this.",
    tips: "A $12 stud finder and a 4-ft level beat guessing.",
  });

  const uprights = by("upright");
  const backs = by("back");
  const tops = by(["top", "bottom"]);
  if (uprights.length || backs.length || tops.length) {
    steps.push({
      step: n++,
      title: `Rip the ${sheet}`,
      description: `Break the sheet down before you crosscut. ${
        uprights.length ? `Uprights first — they set every other length: ${list(uprights)}.` : ""
      } ${backs.length ? `Back: ${list(backs)}.` : ""} ${tops.length ? `Top/bottom: ${list(tops)}.` : ""} Label each piece on the waste face.`,
      partsUsed: [...uprights, ...backs, ...tops].map((p) => p.name),
      tips: "A circular saw and a straightedge. Support the offcut so it does not break out.",
    });
    steps.push({
      step: n++,
      title: "Crosscut and dry-stack",
      description: "Crosscut the uprights to finished height. Stand them with the back, no glue. Check both diagonals and the front reveal. If it is racked now, it will be racked forever.",
      partsUsed: [...uprights, ...backs].map((p) => p.name),
    });
  }

  const divs = by("divider");
  const counters = by("counter");
  const kicks = by("kick");
  if (uprights.length || backs.length) {
    steps.push({
      step: n++,
      title: "Glue the carcase square",
      description: "Glue and screw uprights to the back. Check diagonals again before the glue grabs. A pair of clamps and a framing square beat hope.",
      partsUsed: [...uprights, ...backs, ...tops].map((p) => p.name),
      tips: "1¼\" screws, ¾\" in from the edge. Predrill near the end grain.",
    });
  }
  if (divs.length || counters.length) {
    steps.push({
      step: n++,
      title: counters.length ? "Set dividers and the work surface" : "Set the dividers",
      description: [
        divs.length ? `Dividers: ${list(divs)}. These split the bays — dry-fit the drawer openings before you glue.` : "",
        counters.length ? `Work surface: ${list(counters)}. It sits level even if the floor is not.` : "",
        kicks.length ? `Toekick only where listed: ${list(kicks)}. Leave any knee bay open to the floor.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      partsUsed: [...divs, ...counters, ...kicks].map((p) => p.name),
    });
  }

  const drawers = by("drawer");
  drawers.forEach((d, i) => {
    steps.push({
      step: n++,
      title: `Hang drawer ${i + 1} of ${drawers.length} — ${d.name}`,
      description: `${dim(d)}". Pair of side-mount slides. Screw the cabinet member first, then the box. Do not glue the slides. Cycle it twice before you hang the next one.`,
      partsUsed: [d.name],
      tips: i === 0 ? "Confirm slide length against the carcase depth before you buy." : undefined,
    });
  });

  const shelves = by("shelf");
  if (shelves.length) {
    steps.push({
      step: n++,
      title: `Bore shelf pins and set ${shelves.length} shelf${shelves.length === 1 ? "" : "ves"}`,
      description: `${list(shelves)}. 5 mm pins, two rows, same height both sides. Dry-fit the lowest shelf first — if it binds, the box is out of square.`,
      partsUsed: shelves.map((p) => p.name),
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
  doors.forEach((d, i) => {
    steps.push({
      step: n++,
      title: `Hang door ${i + 1} — ${d.name}`,
      description: `${dim(d)}". Two hinges. Set the reveal even with a playing card. Adjust after the box is standing in its final place.`,
      partsUsed: [d.name],
    });
  });

  const mirrors = by("mirror");
  if (mirrors.length) {
    steps.push({
      step: n++,
      title: "Hang the mirror",
      description: list(mirrors) + ". Center it on the knee bay, between the counter and the uppers. Use proper mirror clips or a french cleat — not command strips.",
      partsUsed: mirrors.map((p) => p.name),
    });
  }

  steps.push({
    step: n++,
    title: project.assumptions.installMode === "freestanding" ? "Level and load a shelf" : "Shim, then anchor into studs",
    description:
      project.assumptions.installMode === "freestanding"
        ? `Level ${project.name} front-to-back and side-to-side. The back is already on the bench so the box cannot rack. Put weight on the longest shelf and watch for bounce.`
        : `Set the unit on the centerline. Shim the tight side — do not rack the box to match the wall. Fasten the back and both uprights into the studs you marked. ${project.pocket ? `Tight side is ${project.pocket.rightClear < project.pocket.leftClear ? "right" : "left"} (${Math.min(project.pocket.leftClear, project.pocket.rightClear).toFixed(1)}").` : ""}`,
    tips: "Guidance only. Not stamped engineering. Confirm plumbing and studs before you cut.",
  });

  steps.push({
    step: n,
    title: "Walk away overnight",
    description: "Do not load drawers or hang clothes until the glue has cured. Wipe squeeze-out now; it is harder tomorrow.",
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
  const join = (item?.preferredJoins && item.preferredJoins[0]) || "glue";
  const hold =
    join === "glue"
      ? "Wood glue. Hold 30–60 seconds. Wipe squeeze-out. It will not take load until tomorrow."
      : join === "solvent"
        ? "Solvent cement is permanent. Dry-fit the whole bay first."
        : `Primary join: ${join}.`;
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
    title: "Lay out the footprint on the bench",
    description: `Tape a rectangle ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}" on the bench. That is the base. Mark centerlines both ways so the first joints land where the drawing says.`,
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
      description: `${lines}. Cut one, check it against the next piece in that role, then batch the rest. Keep offcuts longer than 1" — they become gussets.`,
      tips: "One wrong cut wastes a whole stick. Mark with a pencil, not hope.",
    });
  } else {
    steps.push({
      step: n++,
      title: "Sort full-length stock by role",
      description: "Most members are full stock. Stack legs, rings, and braces in three piles so you do not grab a brace when you need a chord.",
    });
  }

  const order: { role: string; title: string; why: string; extra?: string }[] = [
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
      description: `${listI.length} ${spec.role} members. ${hold} Lengths in this role: ${sample || "full stock"}. ${spec.extra ?? ""} Dry-fit the bay, then join. ${spec.why}`,
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
    description: `Touch every joint on ${project.name}. A dry joint will open when you lift it. Add a drop of ${join} where two pieces only kiss.`,
    tips: `${project.buildStats?.joints ?? "Many"} joints on this build. Work from the base up so you do not lean on wet work.`,
  });

  steps.push({
    step: n,
    title: "Cure overnight, then pick it up by the base",
    description: `Do not lift ${project.name} by the tip until the joints have cured. Set it on a flat table and look for daylight under a foot. If it rocks, the base was not square — shim, do not twist.`,
    tips: project.notes.find((note) => /slender|rack|fail|anchor/i.test(note)) ?? "Guidance only — not stamped engineering.",
    partsUsed: ["*"],
  });

  return steps;
}
