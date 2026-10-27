/**
 * The measure box: a wire box at the measured width × height × depth, drawn on the bench as an overlay line.
 * Bench-only, never a part. Bottom and top are closed rectangles through all four corners, plus four uprights.
 */
export type Pt = [number, number, number];

export function measureBoxStrokes(width: number, height: number, depth: number): Pt[][] {
  const hx = width / 2, hz = depth / 2;
  const ring = (y: number): Pt[] => [[-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz], [-hx, y, -hz]];
  return [
    ring(0),
    ring(height),
    [[-hx, 0, -hz], [-hx, height, -hz]],
    [[hx, 0, -hz], [hx, height, -hz]],
    [[hx, 0, hz], [hx, height, hz]],
    [[-hx, 0, hz], [-hx, height, hz]],
  ];
}
