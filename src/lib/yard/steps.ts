/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { slideInches } from "./stockLook";
import { shopPlural } from "./shopPlural";
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
  const panels = project.panels;
  if (!panels.length) {
    return [
      {
        step: 1,
        title: "Empty bench",
        description: "Generate a thing first. These steps are written from the pieces on the bench.",
      },
    ];
  }

  const item = getCatalogItem(panels[0]?.materialId ?? project.primaryMaterialId);
  const tool = cutHow(item);
  const of = (t: Panel["type"]) => panels.filter((p) => p.type === t);
  const names = (list: Panel[]) => list.map((p) => p.name);
  const cutLine = (p: Panel) =>
    `${p.name} — ${round(p.size.width)} × ${round(p.size.height)} × ${round(p.size.depth)}"`;

  const uprights = of("upright");
  const backs = of("back");
  const bottoms = of("bottom");
  const dividers = of("divider");
  const shelves = of("shelf");
  const drawers = of("drawer");
  const doors = of("door");
  const kicks = of("kick");
  const mirrors = of("mirror");
  const rails = of("rail");

  const u = project.fitted?.unit;
  const pocket = project.pocket;
  const opening = project.opening;
  const program = project.fitted?.program ?? (pocket ? "vanity" : "closet");
  const W = u?.width ?? opening?.width ?? project.overall.width;
  const H = u?.height ?? opening?.height ?? project.overall.height;
  const D = u?.depth ?? opening?.depth ?? project.overall.depth;
  const alcove = opening?.kind === "alcove" || opening?.kind === "pocket" || project.assumptions.installMode === "alcove";
  const slide = drawers.length ? slideInches(D) : 0;

  const sheetCuts = groupSheetCuts(panels);
  const steps: AssemblyStep[] = [];
  let n = 1;

  const coatRack =
    /coat/i.test(project.name) ||
    (/coat/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()) && !/shoe/.test((project.prompt ?? "").toLowerCase()));
  if (coatRack && !uprights.length) {
    const hooks = Math.max(3, Math.min(8, Math.round(W / 6)));
    const rail = backs[0] ?? panels[0];
    const shelf = of("top")[0];
    return [
      {
        step: 1,
        title: "Cut the peg rail and hat shelf",
        description: `${tool.how} ${sheetCuts.join(" ")} ${rail ? cutLine(rail) + "." : ""} ${shelf ? cutLine(shelf) + "." : ""} Label the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 2,
        title: "Glue the hat shelf on the rail",
        description: `${shelf ? cutLine(shelf) : "Hat shelf"}. Glue and #8 × 1¼" screws through the shelf into the top edge of the ${rail?.name ?? "peg rail"}. Front edge flush. This is a wall rack, not a box.`,
        tips: "Predrill so the ply does not split. Wipe squeeze-out.",
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: `Screw ${hooks} coat hooks`,
        description: `Mark ${hooks} holes on the rail, about 6" on center, 1½" up from the bottom edge. Screw the hooks into the rail — not into the shelf.`,
        tips: "A cheap 6-pack of wall coat hooks is the whole hardware kit besides screws.",
        partsUsed: names(backs.length ? backs : panels),
      },
      {
        step: 4,
        title: "Hang it on studs",
        description: `Find two studs. Predrill the rail. Drive 3" structural screws through the rail into the studs. A coat full of wet jackets will rip it off drywall anchors.`,
        tips: "Guidance only — hit a stud. Confirm the wall.",
        partsUsed: names(backs.length ? backs : panels),
      },
    ];
  }

  if (pocket) {
    steps.push({
      step: n++,
      title: "Confirm the pocket — do not cut yet",
      description: `Back ${pocket.walls.backWidth}" · left depth ${pocket.walls.leftDepth}" @ ${pocket.walls.leftAngleDeg.toFixed(1)}° · right depth ${pocket.walls.rightDepth}" @ ${pocket.walls.rightAngleDeg.toFixed(1)}° · ${pocket.walls.height}" high. Unit ${pocket.unit.width}" W × ${pocket.unit.depth}" D × ${pocket.unit.height}" H, centered, front parallel to the back wall. Measure three heights and both flares.`,
      tips: "The walls are the trapezoid. The unit is a rectangle. Do not rack the box to follow the flare.",
      partsUsed: ["*"],
    });
  } else {
    steps.push({
      step: n++,
      title: alcove ? "Confirm the opening — do not cut yet" : "Confirm the footprint — do not cut yet",
      description: `${project.name}. Unit ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. ${
        alcove
          ? `Fitted to a ${opening?.width}" × ${opening?.height}" × ${opening?.depth}" ${opening?.kind}. Measure width, height, and depth in three places. Cut to the smallest width.`
          : "Freestanding rectangle. Mark the footprint on the floor. Check it is square."
      } ${panels.length} parts on this list.`,
      tips: "If a number on this plan disagrees with the cut list, trust the cut list. Geometry is from the bench, not from the prompt's adjectives.",
      partsUsed: ["*"],
    });
  }

  steps.push({
    step: n++,
    title: `Cut the ${item?.name ?? "3/4\" plywood"}`,
    description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face before you move the stack.`,
    tips: tool.tip,
    partsUsed: ["*"],
  });

  if (uprights.length && (backs.length || bottoms.length || of("top").length)) {
    const uDesc = uprights.map(cutLine).join("; ");
    const box = [...backs, ...bottoms, ...of("top")].map(cutLine).join("; ");
    steps.push({
      step: n++,
      title: "Stand the carcase (the main box)",
      description: `Lay the two uprights on edge. ${uDesc}. Glue and #8 × 1¼" screws: back into both uprights, then bottom, then top. ${box || "Back, top, and bottom as labeled."} Predrill near the ends so the ply does not split.`,
      tips: doors.length
        ? "Check both diagonals before the glue skins. A 1/8\" difference will show in the doors. Dry-fit first (assemble without glue) if this is your first box."
        : "Check both diagonals before the glue skins. Dry-fit first (assemble without glue) if this is your first box.",
      partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top")]),
    });
  }

  if (dividers.length) {
    const knee = dividers.filter((p) => /knee/i.test(p.name));
    const cubby = dividers.filter((p) => /cubby/i.test(p.name));
    const rest = dividers.filter((p) => !/knee|cubby/i.test(p.name));
    if (knee.length) {
      steps.push({
        step: n++,
        title: "Set the knee dividers",
        description: `${knee.map(cutLine).join("; ")}. They land ${u?.kneeW ?? pocket?.unit.kneeW ?? 22}" apart, centered. Screw through the bottom and the counter into each divider. Leave the middle open to the floor — that is the chair space.`,
        tips: "Hang drawer slides on these faces before the last divider goes in — you can still get a screwdriver in.",
        partsUsed: names(knee),
      });
    }
    if (cubby.length) {
      steps.push({
        step: n++,
        title: "Set cubby dividers",
        description: `${cubby.map(cutLine).join("; ")}. Space them evenly. Screw through the top, bottom, and back into each divider.`,
        partsUsed: names(cubby),
      });
    }
    if (rest.length) {
      steps.push({
        step: n++,
        title: "Set remaining dividers",
        description: `${rest.map(cutLine).join("; ")}. Plumb each one. Screw through the back and the nearest shelf or top.`,
        partsUsed: names(rest),
      });
    }
  }

  const counters = of("counter");
  if (counters.length) {
    steps.push({
      step: n++,
      title: program === "desk" ? `Set the desktop at ${round(u?.counterH ?? H)}"` : `Set the counter at ${round(u?.counterH ?? pocket?.unit.vanityH ?? 34)}"`,
      description: `${counters.map(cutLine).join("; ")}. Glue and screw down into the uprights and the knee dividers. Front edge flush. Iron-on edge banding (thin veneer strip that covers the raw plywood edge) on the front if people will see it.`,
      partsUsed: names(counters),
    });
  }

  if (kicks.length) {
    steps.push({
      step: n++,
      title: pocket || u?.kneeW ? "Toekick on the banks only" : "Add the toekick",
      description: `${kicks.map(cutLine).join("; ")}. ${
        pocket || u?.kneeW
          ? "The toekick is the recessed strip at the floor so your toes clear when you stand close. Kick the drawer banks only. Leave the knee open to the floor."
          : "The toekick is the recessed strip at the floor so your toes clear. Cut it from the same ¾\" plywood — 3½\" tall, set back about 3½\" from the front face."
      }`,
      partsUsed: names(kicks),
    });
  }

  if (drawers.length) {
    steps.push({
      step: n++,
      title: `Build ${drawers.length} drawer boxes + fronts`,
      description: `${drawers.map(cutLine).join("; ")}. Build each box to the cut list. Drawer fronts are the faces people see — edge-band the plywood edge (thin veneer strip over the raw edge) if the carcase is ply. One cup pull centered on each front.`,
      tips: "Dry-fit the box in the bay (assemble without glue) before you glue the front on.",
      partsUsed: names(drawers),
    });
    steps.push({
      step: n++,
      title: `Hang ${drawers.length} drawers on ${slide}" slides`,
      description: `One pair of ${slide}" side-mount slides per drawer (metal tracks that screw to the sides of the box and the cabinet). Slide length = box depth. Hang the slides on the dividers first, then set the boxes. Confirm the slide against the ${round(D)}" carcase before you buy.`,
      tips: `A 16" box does not take an 18" slide. ${drawers.length} pairs of ${slide}" slides total.`,
      partsUsed: names(drawers),
    });
  }

  if (shelves.length) {
    steps.push({
      step: n++,
      title: `Pin ${shelves.length} adjustable shel${shelves.length === 1 ? "f" : "ves"} — 4 pins each`,
      description: `${shelves.map(cutLine).join("; ")}. Drill 5mm pin holes in both uprights (and dividers if the bay is split), 1¼" from the front, 32mm (about 1¼") apart — the standard shelf-pin spacing. Four pins per shelf (${shelves.length * 4} pins total). Do not glue the shelves; the pins hold them so you can move them later.`,
      tips: "A pegboard jig or a 32mm shelf-pin jig beats measuring every hole twice.",
      partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top"), ...shelves]),
    });
  }

  if (rails.length) {
    steps.push({
      step: n++,
      title: "Seat the hanging rod",
      description: `${rails.map(cutLine).join("; ")}. Seat in closet-rod sockets on the uprights, about 12" down from the top of the hanging bay.`,
      partsUsed: names(rails),
    });
  }

  if (doors.length) {
    steps.push({
      step: n++,
      title: `Hang ${doors.length} door${doors.length === 1 ? "" : "s"} — 2 hinges each`,
      description: `${doors.map(cutLine).join("; ")}. Two concealed hinges per door (${doors.length * 2} hinges total), 3–4" from top and bottom. Overlay the carcase (the door sits on top of the face, not inside the opening). Soft-close if you bought them. Adjust the screws until the gap is even.`,
      partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top"), ...shelves, ...doors]),
    });
  }

  if (mirrors.length) {
    steps.push({
      step: n++,
      title: "Hang the mirror",
      description: `${mirrors.map(cutLine).join("; ")}. Over the knee, between the counter and the uppers. French cleat (two interlocking angled strips — one on the wall, one on the mirror) or mirror clips into studs — not into the plywood back alone.`,
      partsUsed: names(mirrors),
    });
  }

  steps.push({
    step: n++,
    title: alcove ? "Shim, then lag into studs" : "Level it",
    description: alcove
      ? pocket
        ? `Fasten the back and both uprights into the studs you marked. Shim the tight side (thin wedges to fill the gap — R ${pocket.rightClear.toFixed(1)}" / L ${pocket.leftClear.toFixed(1)}"). Scribe (mark and cut the edge to match the wall) — don't force. The rectangle stays a rectangle.`
        : `Slide the box into the ${round(W)}" × ${round(H)}" × ${round(D)}" opening. Shim the tight side (thin wedges). Lag (long heavy screws) through the uprights into studs (or masonry anchors). Do not rack (twist) the box to match a wonky wall.`
      : "Level the unit. The back is already on it so it cannot rack (twist). If it sits on a floor that is out, shim the feet — do not twist the carcase (main box).",
    tips: "Guidance only — confirm plumbing, studs, and the real opening before you cut. Not stamped engineering.",
    partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top"), ...shelves, ...doors, ...dividers]),
  });

  return steps;
}

function groupSheetCuts(panels: Panel[]): string[] {
  const map = new Map<string, { qty: number; label: string; w: number; h: number; d: number }>();
  for (const p of panels) {
    const w = Math.round(p.size.width * 8) / 8;
    const h = Math.round(p.size.height * 8) / 8;
    const d = Math.round(p.size.depth * 8) / 8;
    const family =
      p.type === "upright"
        ? "upright"
        : p.type === "shelf"
          ? "shelf"
          : p.type === "divider"
            ? "divider"
            : p.type === "top" || p.type === "counter"
              ? p.type === "counter"
                ? "counter"
                : "top"
              : p.type === "bottom"
                ? "bottom"
                : p.type === "back"
                  ? "back"
                  : p.type === "door"
                    ? "door"
                    : p.type === "drawer"
                      ? "drawer box"
                      : p.type === "kick"
                        ? "toekick"
                        : p.type === "mirror"
                          ? "mirror"
                          : p.type === "rail"
                            ? "rod"
                            : p.name;
    const key = `${family}|${w}|${h}|${d}`;
    const g = map.get(key);
    if (g) g.qty += 1;
    else map.set(key, { qty: 1, label: family, w, h, d });
  }
  return [...map.values()].map((g) => {
    const a = round(g.w);
    const b = round(g.h);
    const c = round(g.d);
    return `${g.qty} ${shopPlural(g.label, g.qty)} ${a} × ${b} × ${c}".`;
  });
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

function midY(i: YardInstance) {
  if (i.from && i.to) return (i.from.y + i.to.y) / 2;
  return i.position.y;
}

function uniqueEiffelSteps(project: YardProject): AssemblyStep[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const { hold } = joinHold(item);
  const H = Math.max(project.overall.height, 1);
  const y1 = (57 / 324) * H;
  const yLantern = 0.9 * H;
  const whole = !!item && isWholeStock(item) && project.instances.every((i) => !i.cutLength);

  const band = (key: string) =>
    project.instances.filter((i) => {
      const y = midY(i);
      const role = i.role ?? "member";
      if (key === "arch") return role === "support";
      if (key === "foot") return role === "base" || y < H * 0.025;
      if (key === "lantern") return y >= yLantern || role === "tip";
      if (key === "web") return role === "brace";
      if (key === "deck1") return (role === "rail" || role === "ring") && Math.abs(y - y1) < H * 0.06;
      if (key === "pier") return role === "leg" && y < y1;
      if (key === "shaft") return role === "leg" && y >= y1 && y < yLantern;
      if (key === "belts") return (role === "rail" || role === "ring") && y > y1 + H * 0.06 && y < yLantern;
      return false;
    });

  const steps: AssemblyStep[] = [];
  let n = 1;
  steps.push({
    step: n++,
    title: whole ? "Read this Eiffel before you glue" : "Read this Eiffel before you cut",
    description: `${cutSummary(project.instances, item?.name ?? "stock")} About ${project.overall.height.toFixed(0)}" tall. Four arches, four piers, then one shaft — same tower as the bench. Each step lights only that part.`,
    tips: "If a plate looks like a scribble, you are on the face lattice. Go back to the arches — those are the holes you walk through.",
    partsUsed: ["*"],
  });
  steps.push({
    step: n++,
    title: "Tape the four feet on the bench",
    description: `Tape a square ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}". One pad per corner. Check both diagonals.`,
    tips: "A parallelogram base makes a leaning tower. You cannot fix that later.",
    partsUsed: band("foot").map((i) => i.id),
  });
  if (whole) {
    steps.push({
      step: n++,
      title: `Do not cut — ${item?.name ?? "stock"}s stay whole`,
      description: `${project.instances.length} full pieces from the pack. Glue them as they come. The bench is a gluing diagram.`,
      partsUsed: ["*"],
    });
  }

  const scenes: { key: string; title: string; why: string }[] = [
    { key: "arch", title: "Glue the four arches", why: "One chain of sticks per face. These are the four holes you walk through — the thing that makes it Eiffel, not a pyramid." },
    { key: "pier", title: "Stand the four piers", why: "Each corner is a thick lattice column up to the first deck." },
    { key: "deck1", title: "Close the first deck", why: "This ring is the break in the picture: four legs become one shaft. Square it before you go up." },
    { key: "shaft", title: "Raise the shaft", why: "Above the first deck the four piers have merged. Keep going up the center." },
    { key: "belts", title: "Add the belts", why: "Horizontal rings at the upper platforms." },
    { key: "web", title: "Lace the face lattice", why: "This is the texture in the render — Warren faces and pier web." },
    { key: "lantern", title: "Cap the lantern", why: "The little cage at the tip." },
  ];

  for (const scene of scenes) {
    const listI = band(scene.key);
    if (!listI.length) continue;
    const perFace = scene.key === "arch" ? Math.round(listI.length / 4) : 0;
    steps.push({
      step: n++,
      title: scene.title,
      description: `${listI.length} stick${listI.length === 1 ? "" : "s"}${perFace ? ` — about ${perFace} per arch` : ""}. ${hold} ${scene.why}`,
      partsUsed: listI.map((i) => i.id),
      tips: scene.why,
    });
  }

  steps.push({
    step: n++,
    title: "Stand it up and walk around",
    description: `If an arch sags, that joint was dry. Overnight before you lift by the tip.`,
    tips: "Guidance only — not stamped engineering.",
  });
  return steps;
}

function uniqueForgeSteps(project: YardProject): AssemblyStep[] {
  if (project.kind === "eiffel") return uniqueEiffelSteps(project);
  const item = getCatalogItem(project.primaryMaterialId);
  const { hold } = joinHold(item);
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
    description: `${cutSummary(project.instances, item?.name ?? "stock")} Envelope about ${project.overall.width.toFixed(0)}" × ${project.overall.height.toFixed(0)}" × ${project.overall.depth.toFixed(0)}".`,
    tips: whole
      ? "Trust the stick list — full pieces, no cuts."
      : "Trust the cut list.",
    partsUsed: ["*"],
  });

  steps.push({
    step: n++,
    title: "Lay out the footprint on the bench",
    description: `Tape a rectangle ${project.overall.width.toFixed(1)}" × ${project.overall.depth.toFixed(1)}" on the bench. Mark centerlines both ways.`,
    tips: "A crooked base cannot be fixed later.",
  });

  if (whole) {
    steps.push({
      step: n++,
      title: `Do not cut — ${item?.name ?? "stock"}s stay whole`,
      description: `${project.instances.length} full pieces from the pack. Glue them as they come.`,
      tips: "A pack and a bottle of glue is the whole kit.",
      partsUsed: ["*"],
    });
  } else if (marked.length) {
    steps.push({
      step: n++,
      title: "Cut the marked lengths — same size is the same letter",
      description: `${tool.how} Mark A, B, C on the first of each size, then batch the rest.`,
      tips: tool.tip,
    });
  }

  const order = roleScript(project);
  for (const spec of order) {
    const listI = byRole.get(spec.role);
    if (!listI?.length) continue;
    steps.push({
      step: n++,
      title: `${spec.title} — ${listI.length} ${spec.role}${listI.length === 1 ? "" : "s"}`,
      description: `${listI.length} ${spec.role} members. ${hold} ${spec.extra ?? ""} Dry-fit the joint, then join. ${spec.why}`,
      partsUsed: [spec.role],
      tips: spec.why,
    });
  }

  steps.push({
    step: n++,
    title: "Check plumb and square",
    description: "Stand it up. Sight the long edges. If something racks, find the soft joint and re-join.",
    tips: "A lean now is a lean forever.",
  });

  return steps;
}

function roleScript(project: YardProject): { role: string; title: string; why: string; extra?: string }[] {
  if (project.kind === "ladder") {
    return [
      { role: "leg", title: "Cut and mark the two rails", why: "Both rails the same length." },
      { role: "rail", title: "Screw the rungs", why: "Level every rung. Predrill." },
      { role: "brace", title: "Add any remaining stretchers", why: "They keep the rails from walking apart." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (project.kind === "furniture" || project.kind === "chair" || project.kind === "table") {
    return [
      { role: "base", title: "Screw the stretchers that sit on the floor", why: "The seat sits on this. Square it." },
      { role: "leg", title: "Stand the legs — two sides first", why: "Each side is a front leg, a back leg, and a side rail." },
      { role: "rail", title: "Seat rails, slats, and stretchers", why: "Aprons keep the legs from walking apart." },
      { role: "brace", title: "Backrest", why: "The back, not bay lacing." },
      { role: "member", title: "Place remaining members", why: "Anything without a role still has to meet a joint." },
    ];
  }
  if (project.kind === "arch") {
    return [
      { role: "leg", title: "Stand the posts in the slip fittings", why: "Posts go in dry." },
      { role: "support", title: "Set the two crowns", why: "Each crown is one shop-length bend." },
      { role: "rail", title: "Side rails — not across the opening", why: "Rails on the sides only." },
      { role: "brace", title: "Last braces, still clear of the portal", why: "Only if they do not close the walk-through." },
      { role: "member", title: "Place remaining members", why: "No floating pipe." },
    ];
  }
  if (project.kind === "bridge") {
    return [
      { role: "base", title: "Plant the abutments", why: "Each end sits on the ground." },
      { role: "support", title: "Set the bottom chords", why: "Lower chords carry the span." },
      { role: "leg", title: "Raise the verticals", why: "Verticals define the bays." },
      { role: "brace", title: "Lace the Warren diagonals", why: "Zigzag diagonals are the truss." },
      { role: "rail", title: "Close the top chords and deck rails", why: "Top chords finish the truss." },
      { role: "splice", title: "Lap the long splices", why: "Overlap and glue both faces." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  return [
    { role: "base", title: "Dry-fit the base, then glue it", why: "Everything above sits on this." },
    { role: "support", title: "Stand the arches and pier props first", why: "These take the splay and thrust." },
    { role: "leg", title: "Raise the legs, one bay at a time", why: "Glue only as high as you can still reach the joints." },
    { role: "rail", title: "Lace the horizontal rails", why: "Rails lock the legs." },
    { role: "brace", title: "Add the diagonals and web", why: "Diagonals kill racking." },
    { role: "platform", title: "Set the platforms", why: "Platforms are rest stops and stiffness rings." },
    { role: "splice", title: "Lap the splices", why: "Overlap and glue both faces." },
    { role: "member", title: "Fill remaining members", why: "No floating pieces." },
  ];
}
