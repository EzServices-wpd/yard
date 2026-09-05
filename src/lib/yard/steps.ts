/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import {
  climbRiseRun,
  detectWeekendMech,
  isClimbSingleStep,
  isLauncherRamp,
  isMediaDeviceStand,
  launcherRampLengthIn,
  mediaHoldTipDeg,
} from "./weekendFamily";
import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { wantsFixedGlueShelves } from "./honesty";
import { slideInches } from "./stockLook";
import { shopPlural, fmtSheetCut, cutListName } from "./shopPlural";
import type { AssemblyStep, CatalogItem, Panel, YardInstance, YardProject } from "./types";

function dim(p: Panel) {
  return fmtSheetCut(p.size.width, p.size.height, p.size.depth);
}

function round(n: number) {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(2);
}

function list(panels: Panel[]) {
  return panels.map((p) => `${p.name} (${dim(p)}")`).join("; ");
}

function joinHold(item?: CatalogItem | null) {
  const join = (item?.preferredJoins && item.preferredJoins[0]) || "glue";
  if (join === "glue") return { join, hold: "Wood glue. Hold 30–60 seconds. Wipe squeeze-out. Overnight before any load." };
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
  return {
    how: "Circular saw and a straightedge — or take this cut list to the lumber aisle and have them cut the sheets. Good face up. Write the letter from the cut list on the waste face (the side nobody sees).",
    tip: "Support the offcut so it does not splinter. If a number here disagrees with the cut list, trust the cut list.",
  };
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
  const prompt = project.prompt ?? "";
  const mediaHold =
    detectWeekendMech(prompt) === "media-hold" ||
    /picture|photo/i.test(subject) ||
    /picture frame/i.test(project.name);
  const deviceStand = mediaHold && isMediaDeviceStand(prompt);
  const tipDeg = mediaHoldTipDeg(prompt);

  steps.push({
    step: s++,
    title: `Print the ${subject} map`,
    description: `Download the 2D stock map (SVG) and print it on ${paper} paper at 100% scale. Keep the printer at 100% — the map is a gluing diagram.`,
    tips: "Lay full sticks on the printed lines.",
    partsUsed: ["*"],
  });

  steps.push({
    step: s++,
    title: `Count out ${n} whole ${name}`,
    description: `${n} full pieces from the pack. Leave every stick whole. Open the glue.`,
    tips: "A pack and a bottle of glue is the whole kit.",
    partsUsed: ["*"],
  });

  if (mediaHold && deviceStand) {
    const tipTalk = tipDeg != null ? `${tipDeg}° tip` : "the typed tip angle";
    steps.push({
      step: s++,
      title: "Glue the base and lean back",
      description: `Build the stand so it binds a real device envelope at ${tipTalk} — never a flat decal. Base on the paper, lean back on the printed angle. ${hold}`,
      tips: "Dry-fit a real phone or tablet before the glue skins.",
      partsUsed: ["rail", "support"],
    });
    steps.push({
      step: s++,
      title: "Add the front lip that retains the device",
      description: `Glue the front lip so a real phone sits in the envelope at ${tipTalk}. The device leans; it is not a printed sticker face.`,
      tips: "Same pack, same stick — one stock only.",
      partsUsed: ["deck"],
    });
    steps.push({
      step: s++,
      title: "Let it dry, then seat the real device",
      description: `Leave the stand on the paper until the glue skins. Seat a real phone at ${tipTalk} for the recipe video — never a decal.`,
      tips: "Overnight is safest for wood glue.",
    });
    return steps;
  }

  const mech = detectWeekendMech(prompt);
  if (mech === "launcher" && isLauncherRamp(prompt)) {
    const rampLen = launcherRampLengthIn(prompt);
    const lenTalk = rampLen != null ? `${rampLen}" ramp` : "typed ramp length";
    steps.push({
      step: s++,
      title: `Glue the ${lenTalk} incline`,
      description: `Lay whole ${name} on the ramp runners and incline. State the ramp length clearly (${lenTalk}). ${hold}`,
      tips: "The deck is an incline — not a flat silhouette.",
      partsUsed: ["rail", "support"],
    });
    steps.push({
      step: s++,
      title: "Leave the free end open — projectile leaves the ramp",
      description: `Finish the leave-end lip. The free projectile leaves the ramp; do not glue the paper plane onto the deck.`,
      tips: "Soft-launch only — the plane flies free.",
      partsUsed: ["deck"],
    });
    steps.push({
      step: s++,
      title: "Let it dry flat",
      description: `Leave the launch ramp on the paper until the glue skins. Then peel carefully.`,
      tips: "Overnight is safest for wood glue.",
    });
    return steps;
  }
  if (mech === "climb" && isClimbSingleStep(prompt)) {
    const rr = climbRiseRun(prompt);
    const riseRun = rr != null ? `${rr.rise}" rise × ${rr.run}" run` : "typed rise × run";
    steps.push({
      step: s++,
      title: "Glue the weight-bearing climb step",
      description: `Build one climb step at ${riseRun}. Legs and tread only — a weight-bearing human step, not a vehicle incline. ${hold}`,
      tips: "A standing kid loads the tread — square it.",
      partsUsed: ["leg", "rail"],
    });
    steps.push({
      step: s++,
      title: "Brace the step frame",
      description: `Add braces so the ${riseRun} tread cannot rack.`,
      tips: "Same pack, same stick — one stock only.",
      partsUsed: ["brace"],
    });
    steps.push({
      step: s++,
      title: "Let it dry flat",
      description: `Leave the step on the paper until the glue skins. Then peel carefully.`,
      tips: "Overnight is safest for wood glue.",
    });
    return steps;
  }

  if (mediaHold) {
    steps.push({
      step: s++,
      title: "Glue the outer rectangle and mat opening",
      description: `Lay whole ${name} on the outer rectangle, then the inner mat opening. Corners meet with a small glue bead. ${hold}`,
      tips: "The mat opening is the window the picture shows through.",
      partsUsed: ["rail"],
    });
    steps.push({
      step: s++,
      title: "Glue same-stock backing behind the rabbet",
      description: `Place backing bars of the same ${name} behind the inner rectangle so they form a rabbet shelf. Slip the picture into the mat opening — the backing retains it.`,
      tips: "Same pack, same stick — one stock only.",
      partsUsed: ["rail"],
    });
    steps.push({
      step: s++,
      title: "Let it dry flat",
      description: `Leave the picture frame on the paper until the glue skins. Then peel carefully or lift the whole sheet.`,
      tips: "Overnight is safest for wood glue.",
    });
    return steps;
  }

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
    tips: "If a stick is short of a joint, shift it along the line. The map is approximate for hand work.",
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
    `${p.name} — ${fmtSheetCut(p.size.width, p.size.height, p.size.depth)}"`;

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
  const W = u?.width ?? pocket?.unit.width ?? opening?.width ?? project.overall.width;
  const H = u?.height ?? pocket?.unit.height ?? opening?.height ?? project.overall.height;
  const D = pocket?.unit.depth ?? u?.depth ?? opening?.depth ?? project.overall.depth;
  const alcove = opening?.kind === "alcove" || opening?.kind === "pocket" || project.assumptions.installMode === "alcove";
  const wallHang = project.assumptions.installMode === "wall";
  const slide = drawers.length ? slideInches(D) : 0;

  const sheetCuts = groupSheetCuts(panels);
  const steps: AssemblyStep[] = [];
  let n = 1;

  const coatPrompt = (project.prompt ?? "").toLowerCase();
  const coatRack =
    /coat/i.test(project.name) ||
    (/coat/.test(coatPrompt) && /rack|rail|hook|peg|tree/.test(coatPrompt) && !/shoe/.test(coatPrompt));
  if (coatRack && !uprights.length) {
    const hookSaid = coatPrompt.match(/(\d+)\s*hooks?/);
    const hooks = hookSaid
      ? Math.max(2, Math.min(12, parseInt(hookSaid[1], 10)))
      : Math.max(3, Math.min(8, Math.round(W / 6)));
    const rail = backs[0] ?? panels[0];
    const shelf = of("top")[0];
    const portal =
      /door\s*portal|portal|doorway|door opening/.test(coatPrompt) ||
      /portal/i.test(project.name);
    const openingH = project.opening?.height ?? project.overall.height;
    const mountFromOpening = Math.round(Math.min(60, Math.max(48, openingH * 0.7)));
    const hangStep = portal
      ? {
          step: 4,
          title: "Mount height from the opening — keep swing clear",
          description: `Mount height from the opening: set the rail ${mountFromOpening}" up from the finished floor of the ${Math.round(project.opening?.width ?? W)}" × ${Math.round(openingH)}" door portal. Predrill. Drive 3" structural screws into studs. Keep clear swing — the door must open past the hooks without hitting coats.`,
          tips: "PDF states mount height from the opening. Guidance only — confirm the portal.",
          partsUsed: names(backs.length ? backs : panels),
        }
      : {
          step: 4,
          title: "Hang it on studs",
          description: `Find two studs. Predrill the rail. Drive 3" structural screws through the rail into the studs. A coat full of wet jackets will rip it off drywall anchors.`,
          tips: "Guidance only — hit a stud. Confirm the wall.",
          partsUsed: names(backs.length ? backs : panels),
        };
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
        tips: "A cheap hook pack is the whole hardware kit besides screws.",
        partsUsed: names(backs.length ? backs : panels),
      },
      hangStep,
    ];
  }

    if (panels.some((p) => /Climb step-shelf/i.test(p.name)) && uprights.length) {
    const tread = panels.find((p) => /Climb step-shelf/i.test(p.name));
    const steps0: AssemblyStep[] = [];
    let n0 = 1;
    steps0.push({
      step: n0++,
      title: "Cut the carcase and climb step-shelf",
      description: `${tool.how} ${sheetCuts.join(" ")} Include the weight-bearing climb step-shelf at mid height. Freeze envelope stays ${Math.round(W)}" × ${Math.round(H)}" × ${Math.round(D)}".`,
      tips: tool.tip,
      partsUsed: names(panels),
    });
    steps0.push({
      step: n0++,
      title: "Stand the carcase (the main box)",
      description: `Glue and screw uprights, back, bottom, and top. Keep ${Math.round(W)}" × ${Math.round(H)}" × ${Math.round(D)}" square.`,
      tips: "Predrill near the ends so the ply does not split.",
      partsUsed: names(uprights),
    });
    steps0.push({
      step: n0++,
      title: "Seat the weight-bearing climb step-shelf",
      description: `${tread ? cutLine(tread) : "Climb step-shelf"}. Mid-height tread to reach the top — weight-bearing, not a pin shelf. Screw through the uprights into the tread.`,
      tips: "Confirm freeze dims stay green before you cut.",
      partsUsed: names(panels.filter((p) => /Climb step-shelf|Step nosing|Shelf/i.test(p.name))),
    });
    steps0.push({
      step: n0++,
      title: "Hang the door and finish",
      description: `Hang any door so it clears the climb step-shelf. Guidance only.`,
      tips: "Confirm the opening.",
      partsUsed: names(panels),
    });
    return steps0;
  }

  const daybed =
    /day\s*bed/i.test(project.name) ||
    /\bday\s*beds?\b/.test((project.prompt ?? "").toLowerCase());
  if (daybed) {
    const posts = uprights.length ? uprights : panels.filter((p) => /post/i.test(p.name));
    const decks = panels.filter((p) => p.type === "deck" || /sleep deck/i.test(p.name));
    const dayRails = panels.filter((p) => /backrest|side rail|apron/i.test(p.name));
    const sheetCuts = panels.map((p) => `${p.name} ${fmtSheetCut(p.size.width, p.size.height, p.size.depth)}".`);
    return [
      {
        step: 1,
        title: "Confirm the footprint — do not cut yet",
        description: `${project.name}. One sleep deck with a backrest — ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. Sit or sleep; not a bunk stack. ${panels.length} parts on this list.`,
        tips: "A daybed is one deck you can sit on, with a backrest — not two bunks and not a loft. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the four posts and set the sleep deck",
        description: `${posts.map(cutLine).join("; ")}. ${decks.map(cutLine).join("; ") || "Sleep deck."}. Screw the deck into the posts at sit/sleep height. Glue the joints too.`,
        tips: "Square the frame before the backrest goes on.",
        partsUsed: names([...posts, ...decks]),
      },
      {
        step: 4,
        title: "Add the backrest, side rails, and front apron",
        description: `${dayRails.map(cutLine).join("; ") || "Backrest and rails."}. Screw the backrest to the back posts above the deck. Side rails keep a mattress on the platform. Front apron stiffens the open long side.`,
        tips: "Sit-test the deck before you finish.",
        partsUsed: names(dayRails.length ? dayRails : panels),
      },
      {
        step: 5,
        title: "Level it",
        description: "Level the frame on the floor. Shim a foot if the floor is out — do not twist the posts. Add a mattress that fits the deck.",
        tips: "Guidance only — person load is heuristic, not stamped engineering.",
        partsUsed: ["*"],
      },
    ];
  }

  const bunk =
    /bunk|loft bed/i.test(project.name) ||
    /\b(?:bunk|loft\s*bed)\b/.test((project.prompt ?? "").toLowerCase()) ||
    project.fitted?.family === "bunk";
  if (bunk) {
    const decks = panels.filter((p) => p.type === "deck");
    const loft = decks.length === 1 || /loft/i.test(project.name) || /\bloft\s*bed\b/.test((project.prompt ?? "").toLowerCase());
    const posts = uprights.length ? uprights : panels.filter((p) => /post/i.test(p.name));
    const rails = of("rail");
    return [
      {
        step: 1,
        title: "Confirm the sleep size — do not cut yet",
        description: loft
          ? `${project.name}. One elevated sleep platform on a post frame — ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. Match the deck to your mattress (twin is usually ~38×75). ${panels.length} parts on this list.`
          : `${project.name}. Two sleep platforms on a post frame — ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. Match the decks to your mattresses (twin is usually ~38×75). ${panels.length} parts on this list.`,
        tips: loft
          ? "A loft is one elevated deck on a frame — open floor under, not a hollow closet box. If a number disagrees with the cut list, trust the cut list."
          : "A bunk is two decks on a frame — not a hollow closet box. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the four posts",
        description: `${posts.map(cutLine).join("; ")}. Set the posts plumb on the footprint. Temporary braces keep them from racking until the decks go on.`,
        tips: "Check both diagonals on the floor rectangle before you commit.",
        partsUsed: names(posts),
      },
      {
        step: 4,
        title: loft ? "Set the loft sleep platform" : "Set the two sleep platforms",
        description: loft
          ? `${decks.map(cutLine).join("; ")}. Screw the elevated deck into the posts. Leave the floor open under it. Glue the joints too.`
          : `${decks.map(cutLine).join("; ")}. Screw each deck into the posts — lower first, then upper. The decks are the bunks. Glue the joints too.`,
        tips: "Predrill near the ends so the ply does not split. A person will sleep on these — square them.",
        partsUsed: names(decks.length ? decks : panels),
      },
      {
        step: 5,
        title: "Add the upper guard rails",
        description: `${rails.map(cutLine).join("; ") || "Guard rails."}. Screw the rails to the posts above the upper deck so the mattress cannot slide off the long sides or the ends.`,
        tips: "Typical rail sits about 5\" above the upper deck. Guidance only — confirm your mattress thickness.",
        partsUsed: names(rails.length ? rails : panels),
      },
      {
        step: 6,
        title: "Level it and add a ladder",
        description: loft
          ? `Level the frame on the floor. Shim a foot if the floor is out — do not twist the posts. Add a ladder or steps to the loft deck (buy one, or build from the leftover strip).`
          : `Level the frame on the floor. Shim a foot if the floor is out — do not twist the posts. Add a ladder or steps to the upper bunk (buy one, or build from the leftover strip).`,
        tips: "Guidance only — person load is heuristic, not stamped engineering. Anchor to studs if the frame can tip.",
        partsUsed: names(posts),
      },
    ];
  }

  const headboard =
    /headboard/i.test(project.name) ||
    /headboard/.test((project.prompt ?? "").toLowerCase());
  if (headboard && !uprights.length) {
    const slab = backs[0] ?? panels[0];
    return [
      {
        step: 1,
        title: "Confirm the size — do not cut yet",
        description: `${project.name}. One ${round(W)}" × ${round(H)}" × ${round(D)}" plywood slab for behind the mattress. Mark the wall width and how high you want it above the mattress. ${panels.length} part on this list.`,
        tips: "A headboard is a wall board, not a box. If a number on this plan disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} ${slab ? cutLine(slab) + "." : ""} Label the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Hang it on studs",
        description: `Find two studs behind the bed. Predrill the slab. Drive 3" structural screws through the board into the studs, or hang it on a french cleat (two interlocking angled strips — one on the wall, one on the back of the board). Center it on the bed. Typical top sits about 48–56" off the floor — match your mattress and pillows.`,
        tips: "Guidance only — hit a stud. Drywall anchors alone will not hold a full-width plywood panel.",
        partsUsed: names(panels),
      },
    ];
  }

  const foldDownCabinet =
    project.fitted?.affordances?.includes("fold-down-board") ||
    /ironing/i.test(project.name) ||
    /ironing/.test((project.prompt ?? "").toLowerCase()) ||
    /fold-down|fold down/i.test(project.name) ||
    /fold[- ]?down|drop[- ]?down/.test((project.prompt ?? "").toLowerCase()) ||
    panels.some((p) => /fold-down board|ironing board/i.test(p.name));
  if (foldDownCabinet) {
    const door = doors[0];
    const board = panels.find((p) => /fold-down board|ironing board/i.test(p.name));
    const leg = panels.find((p) => /support leg/i.test(p.name));
    const ironing = /ironing/i.test(project.name) || /ironing/.test((project.prompt ?? "").toLowerCase());
    const laundry = /laundry/i.test(project.name) || /laundry/.test((project.prompt ?? "").toLowerCase());
    const label = ironing ? "ironing" : laundry ? "laundry fold-down" : "fold-down";
    const hangHint = ironing
      ? "Typical bottom of the cabinet sits about 32–36\" off the floor so the board comes down at ironing height."
      : laundry
        ? "Typical bottom of the cabinet sits about 36–40\" off the floor so the board comes down at folding height."
        : "Typical bottom of the cabinet sits about 32–40\" off the floor so the board comes down at work height.";
    return [
      {
        step: 1,
        title: "Confirm the hang — do not cut yet",
        description: `${project.name}. Wall-mounted ${label} cabinet ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. This hangs on the wall — do not mark a footprint on the floor. Find two studs. ${hangHint} ${panels.length} parts on this list.`,
        tips: `This is a fold-down board in a shallow wall cabinet, not a freestanding folding table and not a storage box. If a number disagrees with the cut list, trust the cut list.`,
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the carcase (the main box)",
        description: `${uprights.map(cutLine).join("; ")}. ${backs.map(cutLine).join("; ")}. ${bottoms.map(cutLine).join("; ")}. ${of("top").map(cutLine).join("; ")}. Glue and #8 × 1¼" screws: back into both uprights, then bottom, then top. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals before the glue skins. Dry-fit first (assemble without glue) if this is your first box.",
        partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top")]),
      },
      {
        step: 4,
        title: "Hang the door — 2 concealed hinges",
        description: `${door ? cutLine(door) + "." : "Door."} Two concealed hinges (cup hinges that mount inside the door and carcase so you do not see them from the front), 3–4" from top and bottom. Overlay the carcase (the door sits on the face, not inside the opening).`,
        tips: "Adjust the screws until the gap is even. A door that will not close is not hung yet.",
        partsUsed: names(doors),
      },
      {
        step: 5,
        title: "Piano-hinge the fold-down board and the support leg",
        description: `${board ? cutLine(board) + "." : "Fold-down board."} ${leg ? cutLine(leg) + "." : ""} Screw a piano hinge (a long continuous hinge) along the bottom edge of the board, into the front of the bottom panel, so the board stores upright and folds down out of the cabinet. A second short hinge on the support leg, onto the underside of the board, so the leg kicks out to the floor when the board is down.`,
        tips: ironing
          ? "Open the door first. The board must clear the door. Staple or clip the ironing-board cover on before you hang it if that is easier on the bench."
          : "Open the door first. The board must clear the door. The support leg carries lean load — do not skip it.",
        partsUsed: names(panels.filter((p) => /fold-down board|ironing board|support leg/i.test(p.name))),
      },
      {
        step: 6,
        title: "Hang it on studs",
        description: `Find two studs. Predrill the back. Drive 3" structural screws through the back into the studs — 4 to 6 screws. A person leaning on the board will rip this off drywall anchors. ${ironing ? "Cover the board. " : ""}Close the door.`,
        tips: ironing
          ? "Guidance only — hit a stud. Confirm the hang height so the board comes down at a height you can iron at."
          : "Guidance only — hit a stud. Confirm the hang height so the board comes down at a height you can work at.",
        partsUsed: names(backs),
      },
    ];
  }

  const medicineCabinet =
    /medicine/i.test(project.name) ||
    /medicine/.test((project.prompt ?? "").toLowerCase());
  if (medicineCabinet) {
    const door = doors[0];
    return [
      {
        step: 1,
        title: "Confirm the hang — do not cut yet",
        description: `${project.name}. Wall-mounted medicine cabinet ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. This hangs on the wall — do not mark a footprint on the floor. Find two studs. Typical center sits about 60–66" off the floor so it is at eye height. ${panels.length} parts on this list.`,
        tips: "This is a shallow wall cabinet with a mirrored door, not a bathroom vanity on the floor. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the carcase (the main box)",
        description: `${uprights.map(cutLine).join("; ")}. ${backs.map(cutLine).join("; ")}. ${bottoms.map(cutLine).join("; ")}. ${of("top").map(cutLine).join("; ")}. Glue and #8 × 1¼" screws: back into both uprights, then bottom, then top. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals before the glue skins. Dry-fit first (assemble without glue) if this is your first box.",
        partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top")]),
      },
      {
        step: 4,
        title: "Set the shelves",
        description: `${shelves.map(cutLine).join("; ") || "Two shelves."}. Rest each shelf on 5 mm pins (four per shelf — two in each upright). Do not glue the shelves; pins let you move them later.`,
        tips: "A medicine bottle is taller than a spice tin — leave the middle gap honest.",
        partsUsed: names(shelves),
      },
      {
        step: 5,
        title: "Hang the door — 2 concealed hinges",
        description: `${door ? cutLine(door) + "." : "Door."} Two concealed hinges (cup hinges that mount inside the door and carcase so you do not see them from the front), 3–4" from top and bottom. Overlay the carcase (the door sits on the face, not inside the opening). Glue a mirror to the outside of the door so it reflects when closed.`,
        tips: "Adjust the screws until the gap is even. A door that will not close is not hung yet. Let the mirror adhesive skin before you hang the cabinet.",
        partsUsed: names(doors),
      },
      {
        step: 6,
        title: "Hang it on studs",
        description: `Find two studs. Predrill the back. Drive 3" structural screws through the back into the studs — 4 screws, one near each corner. A loaded medicine cabinet will rip off drywall anchors. Close the door and check the reveal.`,
        tips: "Guidance only — hit a stud. Confirm the hang height so the mirror is at your eye line.",
        partsUsed: names(backs),
      },
    ];
  }


  const radiatorCover =
    /radiator cover/i.test(project.name) ||
    /radiator/.test((project.prompt ?? "").toLowerCase());
  if (radiatorCover) {
    const tops = panels.filter((p) => /top/i.test(p.name) || p.type === "top");
    const grilles = panels.filter((p) => /grille/i.test(p.name));
    const bottomRails = panels.filter((p) => /bottom rail/i.test(p.name));
    return [
      {
        step: 1,
        title: "Confirm the footprint — do not cut yet",
        description: `${project.name}. Freestanding open-backed radiator cover ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high with a top shelf and front grille slats. Mark the rectangle and check clearance around the radiator. ${panels.length} parts on this list.`,
        tips: "This is an open cover with grille slats, not a sealed cabinet. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face — especially Top shelf and each Grille slat.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the uprights and top shelf",
        description: `${uprights.map(cutLine).join("; ")}. ${tops.map(cutLine).join("; ") || "Top shelf."}. Glue and #8 × 1¼" screws: top into both uprights. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals. Leave the back open so heat can escape against the wall.",
        partsUsed: names([...uprights, ...tops]),
      },
      {
        step: 4,
        title: "Add the bottom rail and grille slats",
        description: `${bottomRails.map(cutLine).join("; ") || "Bottom rail."}. ${grilles.map(cutLine).join("; ") || "Grille slats."}. Screw the bottom rail between the uprights at the front. Space the grille slats evenly and screw each into the top shelf and bottom rail.`,
        tips: "Gaps between slats let heat out. Do not sheet the front solid.",
        partsUsed: names([...bottomRails, ...grilles]),
      },
      {
        step: 5,
        title: "Set it over the radiator",
        description: `Slide the cover over the radiator with air space on all sides. It should not touch hot pipes. Level the top shelf.`,
        tips: "Guidance only — confirm clearances for your radiator and finish before you leave it in place.",
        partsUsed: ["*"],
      },
    ];
  }

  const mudroomBench =
    /mudroom bench|^bench\b/i.test(project.name) ||
    ((/mudroom|window seat/.test((project.prompt ?? "").toLowerCase()) ||
      (/\bbench\b/.test((project.prompt ?? "").toLowerCase()) &&
        !/workbench|park bench/.test((project.prompt ?? "").toLowerCase()))) &&
      project.fitted?.program === "bench");
  if (mudroomBench) {
    const seats = panels.filter((p) => /seat/i.test(p.name) || p.type === "top");
    const shoe = panels.filter((p) => /shoe/i.test(p.name) || p.type === "bottom");
    const aprons = panels.filter((p) => /apron/i.test(p.name) || (p.type === "rail" && !/hanging/i.test(p.name)));
    const cubbies = panels.filter((p) => /cubby/i.test(p.name));
    return [
      {
        step: 1,
        title: "Confirm the footprint — do not cut yet",
        description: `${project.name}. Freestanding sittable bench ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high with open shoe bays under the seat. Mark the rectangle on the floor and check it is square. ${panels.length} parts on this list.`,
        tips: "This is a bench people sit on, not a hollow storage box. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face — especially Seat, Shoe shelf, Front apron, and each Cubby divider.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the carcase",
        description: `${uprights.map(cutLine).join("; ")}. ${backs.map(cutLine).join("; ")}. ${shoe.map(cutLine).join("; ") || "Shoe shelf."}. ${seats.map(cutLine).join("; ") || "Seat."}. Glue and #8 × 1¼" screws: back into both uprights, then shoe shelf, then seat. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals before the glue skins. The seat must land flush with the tops of the uprights.",
        partsUsed: names([...uprights, ...backs, ...shoe, ...seats]),
      },
      {
        step: 4,
        title: "Set cubby dividers and front apron",
        description: `${cubbies.map(cutLine).join("; ") || "Cubby dividers."}. Space them evenly. Screw through the seat, shoe shelf, and back into each divider — these carry sit load across the span. ${aprons.map(cutLine).join("; ") || "Front apron."}. Glue and screw the front apron under the front edge of the seat between the uprights.`,
        tips: "A 48\" seat without dividers will sag under a sitting adult. Do not skip the dividers.",
        partsUsed: names([...cubbies, ...aprons]),
      },
      {
        step: 5,
        title: "Level it and sit-test",
        description: `Set the bench in place. Shim the feet until it does not rock. Sit on the middle of the seat — it should feel solid, not springy. Wipe glue squeeze-out.`,
        tips: "Guidance only — confirm the seat height for your entry before you finish the wood.",
        partsUsed: ["*"],
      },
    ];
  }

  const spiceRack =
    /spice/i.test(project.name) ||
    (/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  if (spiceRack) {
    const lips = panels.filter((p) => p.type === "rail" || /jar lip/i.test(p.name));
    return [
      {
        step: 1,
        title: "Confirm the hang — do not cut yet",
        description: `${project.name}. Wall-mounted spice rack ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. This hangs on the wall — do not mark a footprint on the floor. Find two studs. Typical bottom sits about 48–54" off the floor so jars are at counter height. ${panels.length} parts on this list.`,
        tips: "This is a wall spice rack, not a floor box. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the rack",
        description: `${uprights.map(cutLine).join("; ")}. ${backs.map(cutLine).join("; ")}. ${shelves.map(cutLine).join("; ") || "Shelves."}. Glue and #8 × 1¼" screws. Do not use shelf pins — jars are heavy and the lips need a solid shelf. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals before the glue skins. Dry-fit first (assemble without glue) if this is your first rack.",
        partsUsed: names([...uprights, ...backs, ...shelves]),
      },
      {
        step: 4,
        title: "Glue the jar lips",
        description: `${lips.map(cutLine).join("; ") || "1.25\" jar lips."}. Glue a 1.25" jar lip on the front of every shelf so jars cannot slide off. #8 × 1¼" screws from behind the lip into the shelf front edge.`,
        tips: "The lip stands on the front edge of the shelf. Wipe squeeze-out before it skins.",
        partsUsed: names(lips),
      },
      {
        step: 5,
        title: "Hang it on studs",
        description: `Find two studs. Predrill the back. Drive 3" structural screws through the back into the studs — 4 screws. Loaded spice jars will rip off drywall anchors.`,
        tips: "Guidance only — hit a stud. Confirm the hang height so jars sit at counter height.",
        partsUsed: names(backs),
      },
    ];
  }

  const wineRack =
    /wine/i.test(project.name) ||
    (/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  if (wineRack) {
    const rails = panels.filter((p) => p.type === "rail" || /bottle rail/i.test(p.name));
    return [
      {
        step: 1,
        title: "Confirm the hang — do not cut yet",
        description: `${project.name}. Wall-mounted wine rack ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. This hangs on the wall — do not mark a footprint on the floor. Find two studs. Typical bottom sits about 36–42" off the floor, or sit it on a counter and still lag it so it cannot tip. ${panels.length} parts on this list.`,
        tips: "This is a wine rack, not a bookcase. Bottles lie on their sides. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the rack",
        description: `${uprights.map(cutLine).join("; ")}. ${backs.map(cutLine).join("; ")}. ${shelves.map(cutLine).join("; ") || "Shelves."}. Glue and #8 × 1¼" screws. Do not use shelf pins — a row of bottles is heavy. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals before the glue skins. Dry-fit first (assemble without glue) if this is your first rack.",
        partsUsed: names([...uprights, ...backs, ...shelves]),
      },
      {
        step: 4,
        title: "Glue the bottle rails",
        description: `${rails.map(cutLine).join("; ") || '1.5" bottle rails.'}. Glue a 1.5" rail on the front of every shelf except the top cap so bottles cannot roll off. #8 × 1¼" screws from behind the rail into the shelf front edge.`,
        tips: "The rail stands on the front edge of the shelf. Wipe squeeze-out before it skins. Bottles lie on their sides, necks facing out.",
        partsUsed: names(rails),
      },
      {
        step: 5,
        title: "Hang it on studs",
        description: `Find two studs. Predrill the back. Drive 3" structural screws through the back into the studs — 4 to 6 screws. A loaded wine rack will rip off drywall anchors.`,
        tips: "Guidance only — hit a stud. Confirm the hang height so you can reach a bottle.",
        partsUsed: names(backs),
      },
    ];
  }

  const overToilet =
    /over-toilet/i.test(project.name) ||
    /over[- ]?(the[- ]?)?toilet|toilet[- ]?(cabinet|storage|shelf)|space[- ]?saver/.test((project.prompt ?? "").toLowerCase());
  if (overToilet) {
    const tank = shelves.find((p) => /tank/i.test(p.name));
    const upper = shelves.filter((p) => !/tank/i.test(p.name));
    const tall = !bottoms.length && !!tank;
    if (tall) {
      return [
        {
          step: 1,
          title: "Measure the toilet — do not cut yet",
          description: `${project.name}. This stands over the toilet, ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. Measure the tank: the ${round(W)}" unit must be wider than the tank, and the tank shelf must sit above it. ${panels.length} parts on this list. The bottom stays open so the toilet fits between the uprights.`,
          tips: "This is not a closed floor box and not a vanity. If a number disagrees with the cut list, trust the cut list.",
          partsUsed: ["*"],
        },
        {
          step: 2,
          title: `Cut the ${item?.name ?? '3/4" plywood'}`,
          description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
          tips: tool.tip,
          partsUsed: names(panels),
        },
        {
          step: 3,
          title: "Stand the uprights and glue the tank shelf",
          description: `${uprights.map(cutLine).join("; ")}. ${tank ? cutLine(tank) + "." : "Tank shelf."} Glue and #8 × 1¼" screws: tank shelf into both uprights at the marked height. Leave the floor open — a bottom panel would sit on the toilet.`,
          tips: "Check both diagonals. The gap under the tank shelf is where the tank lives.",
          partsUsed: names([...uprights, ...shelves.filter((p) => /tank/i.test(p.name))]),
        },
        {
          step: 4,
          title: "Add the upper shelves and the top",
          description: `${upper.map(cutLine).join("; ") || "Upper shelves."} ${of("top").map(cutLine).join("; ")}. Pin the upper shelves (four 5 mm pins each). Glue and screw the top into both uprights.`,
          tips: "Do not glue the upper shelves — pins let you move them later. The tank shelf stays glued.",
          partsUsed: names([...upper, ...of("top")]),
        },
        {
          step: 5,
          title: "Screw the upper back on",
          description: `${backs.map(cutLine).join("; ")}. The back starts at the tank shelf and goes to the top — it does not cover the toilet. Glue and #8 × 1¼" screws into the uprights.`,
          tips: "A full-height back would hit the tank.",
          partsUsed: names(backs),
        },
        {
          step: 6,
          title: "Set it over the toilet and lag into studs",
          description: `Walk the unit over the toilet so the tank sits under the tank shelf, between the uprights. Predrill the uprights. Drive 3" structural screws through each upright into studs — a loaded étagère will tip without a wall lag.`,
          tips: "Guidance only — hit a stud. Confirm tank clearance before you cut. Not stamped engineering.",
          partsUsed: names(uprights),
        },
      ];
    }
    return [
      {
        step: 1,
        title: "Confirm the hang — do not cut yet",
        description: `${project.name}. Wall-mounted cabinet ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high above the toilet tank. This hangs on the wall — do not mark a footprint on the floor. Typical bottom sits about 8–12" above the tank. ${panels.length} parts on this list.`,
        tips: "This is a shallow wall cabinet over the toilet, not a floor vanity. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the carcase (the main box)",
        description: `${uprights.map(cutLine).join("; ")}. ${backs.map(cutLine).join("; ")}. ${bottoms.map(cutLine).join("; ")}. ${of("top").map(cutLine).join("; ")}. Glue and #8 × 1¼" screws: back into both uprights, then bottom, then top.`,
        tips: "Check both diagonals before the glue skins.",
        partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top")]),
      },
      {
        step: 4,
        title: "Set the shelves",
        description: `${shelves.map(cutLine).join("; ") || "Shelves."}. Rest each shelf on 5 mm pins (four per shelf). Do not glue the shelves; pins let you move them later.`,
        partsUsed: names(shelves),
      },
      {
        step: 5,
        title: "Hang it on studs above the tank",
        description: `Find two studs above the toilet. Predrill the back. Drive 3" structural screws through the back into the studs. Leave clearance over the tank so the lid still opens.`,
        tips: "Guidance only — hit a stud. Drywall anchors will not hold a loaded cabinet.",
        partsUsed: names(backs),
      },
    ];
  }

  const floatingShelves =
    ((project.panels.some((p) => /cleat/i.test(p.name)) ||
      /floating|wall-?mounted|wall\s+shelves?/i.test(project.name) ||
      /floating|wall-?mounted|wall\s+shelves?/.test((project.prompt ?? "").toLowerCase())) &&
      /shel/i.test(`${project.name} ${project.prompt ?? ""}`) &&
      !uprights.length);
  if (floatingShelves) {
    const cleats = rails.filter((p) => /cleat/i.test(p.name));
    const shelfBoards = shelves.length ? shelves : panels.filter((p) => p.type === "shelf");
    return [
      {
        step: 1,
        title: "Confirm the wall span — do not cut yet",
        description: `${project.name}. ${shelfBoards.length} floating shelf board${shelfBoards.length === 1 ? "" : "s"} and ${cleats.length || shelfBoards.length} wall cleat${(cleats.length || shelfBoards.length) === 1 ? "" : "s"}. Mark studs across the ${round(W)}" span. This is not a box — there are no uprights.`,
        tips: "If a number on this plan disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the shelves and wall cleats`,
        description: `${tool.how} ${sheetCuts.join(" ")} ${shelfBoards.map(cutLine).join("; ")}. ${cleats.map(cutLine).join("; ") || "One wall cleat per shelf (ripped 3/4 strip)."}. Label the waste face.`,
        tips: tool.tip,
        partsUsed: names([...shelfBoards, ...cleats]),
      },
      {
        step: 3,
        title: "Lag each wall cleat into studs",
        description: `${(cleats.length ? cleats : shelfBoards).map(cutLine).join("; ")}. Level a cleat on the wall, hit at least two studs, and drive 3" structural screws through the cleat into the studs. Repeat for each shelf height (about 10" clear between shelves).`,
        tips: "Guidance only — hit a stud. Drywall anchors will not hold a loaded shelf.",
        partsUsed: names(cleats.length ? cleats : panels),
      },
      {
        step: 4,
        title: "Sit each shelf on its cleat and screw down",
        description: `${shelfBoards.map(cutLine).join("; ")}. Set the shelf on the cleat so the back edge is flush to the wall. Drive #8 × 1¼" screws down through the shelf into the cleat. No pins, no uprights, no box to slide into an opening.`,
        tips: "Predrill near the ends so the ply does not split. Wipe squeeze-out if you add glue.",
        partsUsed: names([...shelfBoards, ...cleats]),
      },
    ];
  }

  const hood =
    /range\s*hood|kitchen\s*hood|\bhood\b/i.test(project.name) ||
    /range\s*hood|\bhood\b/.test((project.prompt ?? "").toLowerCase());
  if (hood) {
    const canopy = of("top").find((p) => /canopy/i.test(p.name)) ?? of("top")[0];
    const chimney = of("top").find((p) => /chimney/i.test(p.name));
    return [
      {
        step: 1,
        title: "Confirm the hang — do not cut yet",
        description: `${project.name}. Wall-mounted plywood hood ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high, open on the bottom over the cooktop. Mark the center of the range and the height you want the bottom of the canopy. ${panels.length} parts on this list.`,
        tips: "This is a wood canopy over the cooktop, not a closet. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Glue the canopy — open bottom",
        description: `${uprights.filter((p) => /side/i.test(p.name)).map(cutLine).join("; ") || uprights.slice(0, 2).map(cutLine).join("; ")}. ${backs.filter((p) => /chimney/i.test(p.name) === false).map(cutLine).join("; ")}. ${rails.filter((p) => /apron/i.test(p.name)).map(cutLine).join("; ")}. ${canopy ? cutLine(canopy) : ""}. Glue and #8 × 1¼" screws. The bottom stays open so steam can rise into it.`,
        tips: "Predrill. A closed bottom would trap grease and is not a hood.",
        partsUsed: names(panels.filter((p) => !/chimney/i.test(p.name))),
      },
      {
        step: 4,
        title: chimney ? "Glue the chimney on the canopy" : "Check the open bottom",
        description: chimney
          ? `${uprights.filter((p) => /chimney/i.test(p.name)).map(cutLine).join("; ")}. ${chimney ? cutLine(chimney) + "." : ""} Sit the chimney on the canopy top, flush to the wall-side back. Glue and screws down into the canopy top.`
          : "The canopy is open on the bottom. Do not add a floor.",
        tips: chimney ? "The chimney is decorative / a chase — it is not a flue. A metal liner and fan are optional." : "Leave it open.",
        partsUsed: names(panels.filter((p) => /chimney/i.test(p.name))),
      },
      {
        step: 5,
        title: "Hang it on studs above the range",
        description: `Find two studs centered over the cooktop. Predrill the back. Drive 3" structural screws through the back into the studs. Bottom of the canopy typically sits 24–30" above the cooking surface — match your range and code.`,
        tips: "Guidance only — hit a stud. Drywall anchors will not hold a plywood hood. Confirm clearance over the burners.",
        partsUsed: names(backs),
      },
    ];
  }


  const crate =
    /crate/i.test(project.name) ||
    /crate/.test((project.prompt ?? "").toLowerCase());
  if (crate) {
    const door = doors[0];
    const floor = bottoms[0];
    return [
      {
        step: 1,
        title: "Confirm the kennel — do not cut yet",
        description: `${project.name}. Freestanding wooden dog crate ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. The dog goes inside. Mark the rectangle on the floor. ${panels.length} parts on this list. No shelves.`,
        tips: "This is a kennel with a door, not a bookcase. If a number disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face.`,
        tips: tool.tip,
        partsUsed: names(panels),
      },
      {
        step: 3,
        title: "Stand the sides, floor, and back",
        description: `${uprights.map(cutLine).join("; ")}. ${floor ? cutLine(floor) + "." : ""} ${backs.map(cutLine).join("; ")}. Glue and #8 × 1¼" screws. Floor sits between the sides, tight to the back. Check both diagonals before the glue skins.`,
        tips: "Predrill near the ends so the ply does not split. A square box is a crate; a parallelogram is not.",
        partsUsed: names([...uprights, ...bottoms, ...backs]),
      },
      {
        step: 4,
        title: "Screw the top on",
        description: `${of("top").map(cutLine).join("; ")}. Glue and screw down into both sides and the back. Edges flush.`,
        tips: "Wipe squeeze-out. The top is structural — it keeps the sides from kicking out.",
        partsUsed: names([...of("top"), ...uprights, ...backs]),
      },
      {
        step: 5,
        title: "Hang the door and latch it",
        description: `${door ? cutLine(door) + "." : "Door."} Two 3" utility hinges on the left side of the door, into the left upright. A barrel bolt on the right, shooting into the right upright. The door sits above the floor and leaves a 1½" air gap at the top.`,
        tips: "A crate without a latch is just a box. Test that the bolt catches before you call it done.",
        partsUsed: names(doors),
      },
      {
        step: 6,
        title: "Drill air holes and set it down",
        description: `Drill three 1½" holes, about 2" down from the top, on each side and the back — 4" apart. A wooden crate has to breathe. Set the kennel on the floor. No wall lag.`,
        tips: "Guidance only — confirm the dog still has room to stand and turn. Not stamped engineering.",
        partsUsed: names([...uprights, ...backs]),
      },
    ];
  }

  const island =
    /island/i.test(project.name) ||
    /island/.test((project.prompt ?? "").toLowerCase());
  if (island) {
    const counters = of("counter");
    return [
      {
        step: 1,
        title: "Confirm the footprint — do not cut yet",
        description: `${project.name}. Freestanding island ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. Mark the rectangle on the floor. Check it is square. ${panels.length} parts on this list. Open both sides — there is no back.`,
        tips: "If a number on this plan disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face before you move the stack.`,
        tips: tool.tip,
        partsUsed: ["*"],
      },
      {
        step: 3,
        title: "Stand the two uprights and the bottom shelf",
        description: `${uprights.map(cutLine).join("; ")}. ${bottoms.map(cutLine).join("; ")}. Glue and #8 × 1¼" screws: bottom shelf into both uprights, sitting at 3½" (above the toekick). No back — this is an island you walk around.`,
        tips: "Check both diagonals before the glue skins. Predrill near the ends so the ply does not split.",
        partsUsed: names([...uprights, ...bottoms]),
      },
      {
        step: 4,
        title: "Glue in the middle shelf",
        description: `${shelves.map(cutLine).join("; ") || "Middle shelf."} Glue and screw through the uprights into the shelf. Square it. This shelf is fixed — no pins.`,
        partsUsed: names([...uprights, ...shelves]),
      },
      {
        step: 5,
        title: "Add the toekicks",
        description: `${kicks.map(cutLine).join("; ")}. The toekick is the recessed strip at the floor so your toes clear when you stand close. One on the front, one on the back. 3½" tall, set back about 3½" from each long face.`,
        partsUsed: names(kicks),
      },
      {
        step: 6,
        title: `Set the counter at ${round(H)}"`,
        description: `${(counters.length ? counters : of("top")).map(cutLine).join("; ")}. Glue and screw down into both uprights. Front and back edges flush. Iron-on edge banding (thin veneer strip that covers the raw plywood edge) on the edges people will see.`,
        partsUsed: names(counters.length ? counters : of("top")),
      },
      {
        step: 7,
        title: "Level it",
        description: "This island sits on the floor. Shim the feet if the floor is out — do not twist the box. It has no back, so keep it square.",
        tips: "Guidance only — confirm the real kitchen before you cut. Not stamped engineering.",
        partsUsed: names([...uprights, ...bottoms, ...of("counter"), ...kicks]),
      },
    ];
  }

  const nightstand =
    /nightstand|bedside/i.test(project.name) ||
    /nightstand|bedside/.test((project.prompt ?? "").toLowerCase());
  if (nightstand) {
    return [
      {
        step: 1,
        title: "Confirm the footprint — do not cut yet",
        description: `${project.name}. Freestanding nightstand ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. One drawer over an open shelf — not a mini dresser. Mark the rectangle on the floor. ${panels.length} parts on this list.`,
        tips: "If a number on this plan disagrees with the cut list, trust the cut list.",
        partsUsed: ["*"],
      },
      {
        step: 2,
        title: `Cut the ${item?.name ?? '3/4" plywood'}`,
        description: `${tool.how} ${sheetCuts.join(" ")} Label every piece on the waste face before you move the stack.`,
        tips: tool.tip,
        partsUsed: ["*"],
      },
      {
        step: 3,
        title: "Stand the carcase (the main box)",
        description: `${uprights.map(cutLine).join("; ")}. Glue and #8 × 1¼" screws: back into both uprights, then bottom, then top. ${[...backs, ...bottoms, ...of("top")].map(cutLine).join("; ")}. Predrill near the ends so the ply does not split.`,
        tips: "Check both diagonals before the glue skins. Dry-fit first (assemble without glue) if this is your first box.",
        partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top")]),
      },
      {
        step: 4,
        title: "Glue in the shelf",
        description: `${shelves.map(cutLine).join("; ") || "Shelf."} This shelf is the floor of the drawer bay and the top of the open cubby. Glue and screw through the uprights into the shelf. Square it. No pins — it is fixed.`,
        partsUsed: names([...uprights, ...shelves]),
      },
      {
        step: 5,
        title: "Build 1 drawer box + front",
        description: `${drawers.map(cutLine).join("; ") || "Drawer."} Build the box to the cut list. The drawer front is the face people see — edge-band the plywood edge (thin veneer strip over the raw edge). One cup pull centered on the front.`,
        tips: "Dry-fit the box in the bay (assemble without glue) before you glue the front on.",
        partsUsed: names(drawers),
      },
      {
        step: 6,
        title: `Hang the drawer on ${slide}" slides`,
        description: `One pair of ${slide}" side-mount slides (metal tracks that screw to the sides of the box and the cabinet). Hang the slides on the uprights first, then set the box. Confirm the slide against the ${round(D)}" carcase before you buy.`,
        tips: `A 16" box does not take an 18" slide. 1 pair of ${slide}" slides.`,
        partsUsed: names(drawers),
      },
      {
        step: 7,
        title: "Level it",
        description: "This nightstand sits on the floor. The back is already on it so it cannot rack (twist). Shim the feet if the floor is out — do not twist the carcase (main box).",
        tips: "Guidance only — confirm the bedside height before you cut. Not stamped engineering.",
        partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top"), ...shelves, ...drawers]),
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
      title: alcove
        ? "Confirm the opening — do not cut yet"
        : wallHang
          ? "Confirm the hang — do not cut yet"
          : "Confirm the footprint — do not cut yet",
      description: `${project.name}. Unit ${round(W)}" wide × ${round(D)}" deep × ${round(H)}" high. ${
        alcove
          ? `Fitted to a ${opening?.width}" × ${opening?.height}" × ${opening?.depth}" ${opening?.kind}. Measure width, height, and depth in three places. Cut to the smallest width.`
          : wallHang
            ? "This hangs on the wall — do not mark a footprint on the floor. Find two studs."
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
      description: `One pair of ${slide}" side-mount slides per drawer (metal tracks that screw to the sides of the box and the cabinet). Slide length = box depth. Hang the slides on the ${dividers.length ? "dividers" : "uprights"} first, then set the boxes. Confirm the slide against the ${round(D)}" carcase before you buy.`,
      tips: `A 16" box does not take an 18" slide. ${drawers.length} pairs of ${slide}" slides total.`,
      partsUsed: names(drawers),
    });
  }

  if (shelves.length) {
    const fixedGlue = wantsFixedGlueShelves(project);
    steps.push(
      fixedGlue
        ? {
            step: n++,
            title: `Glue ${shelves.length} fixed shel${shelves.length === 1 ? "f" : "ves"}`,
            description: `${shelves.map(cutLine).join("; ")}. Glue and #8 × 1¼" screws through the uprights into each shelf. Square every bay. These shelves are fixed — no pins.`,
            tips: "Predrill near the ends so the ply does not split. Wipe squeeze-out.",
            partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top"), ...shelves]),
          }
        : {
            step: n++,
            title: `Pin ${shelves.length} adjustable shel${shelves.length === 1 ? "f" : "ves"} — 4 pins each`,
            description: `${shelves.map(cutLine).join("; ")}. Drill 5mm pin holes in both uprights (and dividers if the bay is split), 1¼" from the front, 32mm (about 1¼") apart — the standard shelf-pin spacing. Four pins per shelf (${shelves.length * 4} pins total). Do not glue the shelves; the pins hold them so you can move them later.`,
            tips: "A pegboard jig or a 32mm shelf-pin jig beats measuring every hole twice.",
            partsUsed: names([...uprights, ...backs, ...bottoms, ...of("top"), ...shelves]),
          },
    );
  }

  const hangingRods = rails.filter((p) => /hanging rod/i.test(p.name));
  if (hangingRods.length) {
    steps.push({
      step: n++,
      title: hangingRods.length === 1 ? "Seat the hanging rod" : `Seat ${hangingRods.length} hanging rods — one per bay`,
      description: `${hangingRods.map(cutLine).join("; ")}. Seat each rod in closet-rod sockets on that bay's uprights or dividers, about 12" down from the top of the hanging bay. A rod cannot pass through a divider.`,
      partsUsed: names(hangingRods),
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
    title: alcove ? "Shim, then lag into studs" : wallHang ? "Hang it on studs" : "Level it",
    description: alcove
      ? pocket
        ? `Fasten the back and both uprights into the studs you marked. Shim the tight side (thin wedges to fill the gap — R ${pocket.rightClear.toFixed(1)}" / L ${pocket.leftClear.toFixed(1)}"). Scribe (mark and cut the edge to match the wall) — don't force. The rectangle stays a rectangle.`
        : `Slide the box into the ${round(W)}" × ${round(H)}" × ${round(D)}" opening. Shim the tight side (thin wedges). Lag (long heavy screws) through the uprights into studs (or masonry anchors). Do not rack (twist) the box to match a wonky wall.`
      : wallHang
        ? "Find two studs. Predrill the back. Drive 3\" structural screws through the back into the studs. Do not mark a footprint on the floor and do not shim feet — this is not a floor box."
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
    const family = cutListName(p.name, p.type).toLowerCase();
    const dims = fmtSheetCut(w, h, d);
    const key = `${family}|${dims}`;
    const g = map.get(key);
    if (g) g.qty += 1;
    else map.set(key, { qty: 1, label: cutListName(p.name, p.type), w, h, d });
  }
  return [...map.values()].map((g) => {
    return `${g.qty} ${shopPlural(g.label, g.qty)} ${fmtSheetCut(g.w, g.h, g.d)}".`;
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
  const prompt = project.prompt ?? "";
  const mech = detectWeekendMech(prompt);
  if (project.kind === "ladder" || mech === "climb") {
    if (isClimbSingleStep(prompt)) {
      const rr = climbRiseRun(prompt);
      const riseRun =
        rr != null ? `${rr.rise}" rise × ${rr.run}" run` : "typed rise × run";
      return [
        { role: "leg", title: "Cut the four legs", why: "Legs carry a standing kid — weight-bearing." },
        {
          role: "rail",
          title: "Seat the single climb tread",
          why: `One weight-bearing step at ${riseRun}. Not a vehicle incline.`,
        },
        { role: "brace", title: "Brace the step frame", why: "Braces keep the tread from racking." },
        { role: "member", title: "Place remaining members", why: "No floating pieces." },
      ];
    }
    return [
      { role: "leg", title: "Cut and mark the two rails", why: "Both rails the same length." },
      { role: "rail", title: "Screw the rungs", why: "Level every rung. Predrill." },
      { role: "brace", title: "Add any remaining stretchers", why: "They keep the rails from walking apart." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (mech === "launcher") {
    if (isLauncherRamp(prompt)) {
      const rampLen = launcherRampLengthIn(prompt);
      const lenTalk = rampLen != null ? `${rampLen}" ramp` : "typed ramp length";
      return [
        { role: "rail", title: "Glue the base runners", why: `Base sets the ${lenTalk} footprint.` },
        {
          role: "support",
          title: "Set the incline rails",
          why: `Ramp length ${rampLen != null ? rampLen + '"' : "as typed"} — state it clearly on the bench.`,
        },
        {
          role: "deck",
          title: "Lay the ramp deck — leave the free end open",
          why: "Free projectile leaves the ramp; do not glue the plane on.",
        },
        { role: "brace", title: "Brace the incline", why: "Braces kill racking — leave the leave-end clear." },
        { role: "member", title: "Place remaining members", why: "No floating pieces." },
      ];
    }
    return [
      { role: "rail", title: "Glue the base rails", why: "The base carries the A-frame and the axle pivot." },
      { role: "leg", title: "Stand the A-frame uprights", why: "Twin uprights hold the axle." },
      { role: "support", title: "Seat the axle pivot and throwing arm", why: "Axle is the pivot. The throwing arm swings over it." },
      { role: "deck", title: "Fit the payload cup at the arm tip", why: "Payload sits in the cup on the throw path." },
      { role: "brace", title: "Brace the A-frame faces", why: "Braces kill racking — leave the arm free to swing." },
      { role: "member", title: "Place remaining members", why: "No floating pieces." },
    ];
  }
  if (mech === "media-hold" && isMediaDeviceStand(prompt)) {
    const tip = mediaHoldTipDeg(prompt);
    const tipTalk = tip != null ? `${tip}° tip` : "typed tip";
    return [
      { role: "rail", title: "Glue the base footprint", why: "Base carries the lean stand." },
      {
        role: "support",
        title: `Set the lean back at ${tipTalk}`,
        why: `Binds a real device envelope at ${tipTalk} — never a flat decal.`,
      },
      {
        role: "deck",
        title: "Add the front lip that retains the device",
        why: "A real phone sits in the envelope; not a printed sticker face.",
      },
      { role: "brace", title: "Brace the stand", why: "Keep the tip angle true under the phone." },
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
