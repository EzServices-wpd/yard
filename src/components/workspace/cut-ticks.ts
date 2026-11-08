"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tick-off for the cut list, saved on this device per build (UX plan item 8, Zeigarnik: the open
 * loop of "4 of 7 cut" pulls you back to the bench). Keyed by the build's prompt and size, the same
 * things its share link rebuilds from. Versioned and minimal: just the ticked letters.
 */
const PREFIX = "yard.cut.v1:";
function keyFor(build: string): string {
  let h = 5381;
  for (let i = 0; i < build.length; i++) h = ((h << 5) + h + build.charCodeAt(i)) | 0;
  return PREFIX + (h >>> 0).toString(36);
}

export function useCutTicks(build: string): [Set<string>, (letter: string) => void] {
  const key = keyFor(build);
  const [ticks, setTicks] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      setTicks(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setTicks(new Set());
    }
  }, [key]);
  const toggle = useCallback(
    (letter: string) =>
      setTicks((prev) => {
        const next = new Set(prev);
        if (next.has(letter)) next.delete(letter);
        else next.add(letter);
        try {
          window.localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          /* private mode: ticks last for this visit */
        }
        return next;
      }),
    [key],
  );
  return [ticks, toggle];
}
