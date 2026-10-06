/**
 * Named solid stock (Pine / Oak / Walnut … 1×4) drives the parts: every ¾" part is
 * cut from real boards at their true ¾" × 3½" face. A part wider than one board is
 * edge-glued from strips, then trimmed to size. One board count feeds Buy, the cut
 * step and the glue-up step, so the chip, cut list and Buy list all agree.
 */

export const BOARD_FACE_IN = 3.5;
export const BOARD_LEN_IN = 96;
const KERF_IN = 0.125;
/** Extra length on a glued-up blank so the ends can be squared after glue-up. */
const GLUE_TRIM_IN = 1;

export type SolidPart = { name: string; lengthIn: number; widthIn: number; qty: number };

/** Boards laid edge to edge to make a part this wide (1 = rip from a single board). */
export function stripsForWidth(widthIn: number, face = BOARD_FACE_IN): number {
  if (widthIn <= face + 0.01) return 1;
  // 1/8" to joint the edges and rip clean after glue-up.
  return Math.ceil((widthIn + 0.125) / face - 1e-6);
}

export type SolidBoardPlan = {
  /** 8-ft boards to buy. */
  boards: number;
  /** Parts that are edge-glued (name, how many boards wide, blank length). */
  glueUps: { name: string; qty: number; strips: number; blankLengthIn: number; widthIn: number }[];
};

/** First-fit-decreasing pack of board lengths (1/8" kerf) into 8-ft boards. `face` is the named board's real face (1×4 3½", 1×10 9¼"). */
export function planSolidBoards(parts: SolidPart[], face = BOARD_FACE_IN): SolidBoardPlan {
  const lengths: number[] = [];
  const glueUps: SolidBoardPlan["glueUps"] = [];
  for (const p of parts) {
    if (p.qty <= 0) continue;
    const L = Math.max(p.lengthIn, p.widthIn);
    const w = Math.min(p.lengthIn, p.widthIn);
    const strips = stripsForWidth(w, face);
    if (strips === 1) {
      // Narrow parts: rip as many as fit side by side from one board face.
      const perStrip = Math.max(1, Math.floor((face + KERF_IN) / (w + KERF_IN) + 1e-6));
      const n = Math.ceil(p.qty / perStrip);
      for (let i = 0; i < n; i++) lengths.push(L);
    } else {
      const blank = L + GLUE_TRIM_IN;
      glueUps.push({ name: p.name, qty: p.qty, strips, blankLengthIn: blank, widthIn: w });
      for (let i = 0; i < p.qty * strips; i++) lengths.push(blank);
    }
  }
  // A strip longer than one board is butt-spliced from whole boards.
  const pieces: number[] = [];
  for (const L of lengths) {
    let rest = L;
    while (rest > BOARD_LEN_IN + 1e-6) {
      pieces.push(BOARD_LEN_IN);
      rest -= BOARD_LEN_IN;
    }
    pieces.push(rest);
  }
  pieces.sort((a, b) => b - a);
  const free: number[] = [];
  for (const L of pieces) {
    const need = L + KERF_IN;
    const i = free.findIndex((f) => f + 1e-6 >= L);
    if (i >= 0) free[i] -= need;
    else free.push(BOARD_LEN_IN - need);
  }
  return { boards: Math.max(1, free.length), glueUps };
}

const fmt8 = (n: number) => {
  const e = Math.round(n * 8);
  const whole = Math.floor(e / 8);
  let num = e % 8;
  let den = 8;
  while (num && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return num ? (whole ? `${whole} ${num}/${den}` : `${num}/${den}`) : `${whole}`;
};

/** Plain glue-up instruction for the cut step ("" when nothing is wider than a board). */
export function glueUpTalk(plan: SolidBoardPlan, label: string, face = BOARD_FACE_IN): string {
  if (!plan.glueUps.length) return "";
  const list = plan.glueUps
    .map((g) => `${g.qty > 1 ? `${g.qty} × ` : ""}${g.name} (${g.strips} boards, ${fmt8(g.blankLengthIn)}" long)`)
    .join("; ");
  return `Glue-up first: parts wider than one ${label} (${fmt8(face)}" face) are edge-glued from boards laid side by side — ${list}. Joint the edges straight, glue and clamp every 12", let it cure overnight, then rip to width and cut to length.`;
}
