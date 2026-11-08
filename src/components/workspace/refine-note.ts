/** Bumped each time a Refine applies, so the decision line can tell a Refine apart from a new build or Undo. */
let tick = 0;
export const noteRefine = () => void tick++;
export const refineTick = () => tick;
