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
      tips: "If a number on this plan disagrees with the cut list, trust the cut list. Geometry is from the bench, not from the prompt’s adjectives.",
      partsUsed: ["*"],
    });
  }

  steps.push({
    step: n++,
    title: `Cut the ${item?.name ?? "¾\" plywood"}`,
    description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face before you move the stack.`,
    tips: tool.tip,
    partsUsed: names(panels),
  });

  if (uprights.length && (backs.length || bottoms.length || of("top").length)) {
    const uDesc = uprights.map(cutLine).join("; ");
    const box = [...backs, ...bottoms, ...of("top")].map(cutLine).join("; ");
    steps.push({
      step: n++,
      title: "Stand the carcase",
      description: `Lay the two uprights on edge. ${uDesc}. Glue and #8 × 1¼" screws: back into both uprights, then bottom, then top. ${box || "Back, top, and bottom as labeled."} Predrill near the ends so the ply does not blow out.`,
      tips: "Check both diagonals before the glue skins. A 1/8\" difference will show in the doors.",
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
      description: `${counters.map(cutLine).join("; ")}. Glue and screw down into the uprights and the knee dividers. Front edge flush. Iron-on banding on the front if people will see plywood edge.`,
      partsUsed: names(counters),
    });
  }

  if (kicks.length) {
    steps.push({
      step: n++,
      title: "Toekick on the banks only",
      description: `${kicks.map(cutLine).join("; ")}. ${
        pocket || u?.kneeW
          ? "Kick the drawer banks. Leave the knee open to the floor."
          : "Kick the front, 3½\" up, ½\" in from the face."
      }`,
      partsUsed: names(kicks),
    });
  }

  if (drawers.length) {
    steps.push({
      step: n++,
      title: `Hang ${drawers.length} drawers on ${slide}" slides`,
      description: `${drawers.map(cutLine).join("; ")}. One pair of ${slide}" side-mount slides per drawer. Build the boxes, hang the slides on the dividers first, then set the boxes. Cup pull centered on each front.`,
      tips: `Confirm the slide against the ${round(D)}" carcase before you buy. A 16" box does not take an 18" slide.`,
      partsUsed: names(drawers),
    });
  }

  if (shelves.length) {
    steps.push({
      step: n++,
      title: `Pin ${shelves.length} adjustable shel${shelves.length === 1 ? "f" : "ves"}`,
      description: `${shelves.map(cutLine).join("; ")}. Drill 5mm pin holes in both uprights (and dividers if the bay is split), 1¼" from the front, 32mm / 1¼" apart. Four pins per shelf. Do not glue the shelves.`,
      tips: "A pegboard jig or a 32mm system jig beats measuring every hole twice.",
      partsUsed: names(shelves),
    });
  }

  if (rails.length) {
    steps.push({
      step: n++,
      title: "Hanging rod",
      description: `${rails.map(cutLine).join("; ")}. Seat in closet-rod sockets on the uprights, about 12" down from the top of the hanging bay.`,
      partsUsed: names(rails),
    });
  }

  if (doors.length) {
    steps.push({
      step: n++,
      title: `Hang ${doors.length} door${doors.length === 1 ? "" : "s"}`,
      description: `${doors.map(cutLine).join("; ")}. Two concealed hinges per door, 3–4" from top and bottom. Overlay the carcase. Soft-close if you bought them. Adjust the screws until the gap is even.`,
      partsUsed: names(doors),
    });
  }

  if (mirrors.length) {
    steps.push({
      step: n++,
      title: "Hang the mirror",
      description: `${mirrors.map(cutLine).join("; ")}. Over the knee, between the counter and the uppers. French cleat or mirror clips into studs — not into the plywood back alone.`,
      partsUsed: names(mirrors),
    });
  }

  steps.push({
    step: n++,
    title: alcove ? "Shim, then lag into studs" : "Level it",
    description: alcove
      ? pocket
        ? `Fasten the back and both uprights into the studs you marked. Shim the tight side (R ${pocket.rightClear.toFixed(1)}" / L ${pocket.leftClear.toFixed(1)}"). Scribe, don't force. The rectangle stays a rectangle.`
        : `Slide the box into the ${round(W)}" × ${round(H)}" × ${round(D)}" opening. Shim the tight side. Lag through the uprights into studs (or masonry anchors). Do not rack the box to match a wonky wall.`
      : "Level the unit. The back is already on it so it cannot rack. If it sits on a floor that is out, shim the feet — do not twist the carcase.",
    tips: "Guidance only — confirm plumbing, studs, and the real opening before you cut. Not stamped engineering.",
    partsUsed: names(uprights.concat(backs)),
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
    return `${g.qty} ${g.label}${g.qty === 1 ? "" : "s"} ${a} × ${b} × ${c}".`;
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
      { role: "rail", title: "Screw the rungs", why: "Level every rung. Predrill. The rungs are the thing you stand on." },
      { role: "brace", title: "Add any remaining stretchers", why: "They keep the rails from walking apart." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (project.kind === "furniture" || project.kind === "chair" || project.kind === "table") {
    return [
      { role: "base", title: "Screw the stretchers that sit on the floor", why: "The seat sits on this. Square it or the piece rocks." },
      { role: "leg", title: "Stand the legs — two sides first", why: "Each side is a front leg, a back leg, and a side rail. Then join the sides." },
      { role: "rail", title: "Seat rails, slats, and stretchers", why: "Aprons keep the legs from walking apart. Predrill so the stock does not split." },
      { role: "brace", title: "Backrest", why: "The back, not bay lacing. Dry-fit between the rear legs, then screw." },
      { role: "member", title: "Place remaining members", why: "Anything without a role still has to meet a joint." },
    ];
  }
  if (project.kind === "arch") {
    return [
      { role: "leg", title: "Stand the posts in the slip fittings", why: "Posts go in dry. Check you can walk through before any cement." },
      { role: "support", title: "Set the two crowns", why: "Each crown is one shop-length bend. Dry-fit both before any solvent." },
      { role: "rail", title: "Side rails — not across the opening", why: "Rails on the sides only. An X in the opening makes a fence, not an arch." },
      { role: "brace", title: "Last braces, still clear of the portal", why: "Only if they do not close the walk-through." },
      { role: "member", title: "Place remaining members", why: "No floating pipe." },
    ];
  }
  if (project.kind === "figure") {
    return [
      { role: "leg", title: "Build the legs / lower limbs", why: "Two sides that stand. Same length, or it limps." },
      { role: "rail", title: "Torso and arms", why: "The body sits on the legs. Arms last so you can still stand it up." },
      { role: "brace", title: "Joints and details", why: "Tape or glue the crossings." },
      { role: "tip", title: "Head / cap", why: "Last piece. Do not lean on wet tape." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (project.kind === "bridge") {
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
  // Default lattice / Eiffel / tower / pyramid
  return [
    { role: "base", title: "Dry-fit the base, then glue it", why: "Everything above sits on this. If the base is a parallelogram, the tower leans.", extra: "Check both diagonals within 1/16\"." },
    { role: "support", title: "Stand the arches and pier props first", why: "These take the splay and thrust until the first platform is closed." },
    { role: "leg", title: "Raise the legs, one bay at a time", why: "Glue only as high as you can still reach the joints. Ends meet at the nodes — no stick through another." },
    { role: "rail", title: "Lace the horizontal rails", why: "Rails lock the legs. Work level by level." },
    { role: "brace", title: "Add the diagonals and web", why: "Diagonals kill racking. Ends meet at nodes only." },
    { role: "platform", title: "Set the platforms", why: "Platforms are rest stops and stiffness rings." },
    { role: "splice", title: "Lap the splices", why: "Overlap at least ¾ of a stick width and glue both faces." },
    { role: "member", title: "Fill remaining members", why: "Anything without a role still has to meet a joint. No floating pieces." },
  ];
}
