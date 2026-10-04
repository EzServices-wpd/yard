/**
 * One packer for every stock bought by length (craft sticks, dowels, pipe, boards, lumber legs):
 * cuts share a stock length, longest first, first fit, with the saw kerf between cuts.
 * Buy counts the sticks this returns, so Buy follows the cut list instead of one stick per piece.
 */
export type LinearPack = {
  /** Stock pieces used. */
  sticks: number;
  /** Cuts on each stock piece, longest first. */
  layout: number[][];
  /** Why one extra piece was bought, when the leftover was shorter than the longest cut. */
  spare?: string;
};

export function packLengths(cuts: number[], stockLen: number, kerf = 0.125): LinearPack {
  const S = Math.max(0.5, stockLen);
  const room: number[] = [];
  const layout: number[][] = [];
  // A member longer than the stock is spliced from whole pieces plus one remainder cut.
  const pieces: number[] = [];
  for (const raw of cuts) {
    if (!(raw > 0)) continue;
    let left = raw;
    while (left > S + 1e-6) {
      room.push(0);
      layout.push([S]);
      left -= S;
    }
    pieces.push(left);
  }
  for (const c of pieces.sort((a, b) => b - a)) {
    const k = room.findIndex((r) => r + 1e-6 >= c);
    if (k >= 0) {
      room[k] -= c + kerf;
      layout[k].push(c);
    } else {
      room.push(S - c - kerf);
      layout.push([c]);
    }
  }
  const longest = pieces.reduce((m, n) => Math.max(m, n), 0);
  const leftover = room.reduce((m, n) => Math.max(m, n), 0);
  const shares = layout.some((board) => board.length > 1 && board.some((cut) => Math.abs(cut - longest) < 1e-6));
  let spare: string | undefined;
  // Count the share first. A spare is only for a long cut that sits alone, and only when there are more than four cuts.
  if (pieces.length > 4 && longest > 0 && leftover + 1e-6 < longest && !shares) {
    room.push(S);
    layout.push([]);
    spare = "One extra piece — after the saw cuts, less than the longest piece was left.";
  }
  return { sticks: room.length, layout, spare };
}

/** Kerf for a stock: snips / a fine saw on craft sticks and thin dowels, a saw blade on the rest. */
export function kerfFor(item: { formFactor?: string; dims?: { diameter?: number; thickness?: number; width?: number } }, wholeStock: boolean): number {
  if (wholeStock) return 0.0625;
  const across = item.dims?.diameter ?? Math.min(item.dims?.thickness ?? 9, item.dims?.width ?? 9);
  return across <= 0.5 ? 0.0625 : 0.125;
}
