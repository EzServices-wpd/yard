import { useEffect, useRef, useState } from "react";

/**
 * True while the element is off screen or the tab is hidden, so CSS motion can pause
 * (animation-play-state) and cost nothing.
 */
export function useOffscreen<T extends Element>(rootMargin = "0px", startOff = false) {
  const ref = useRef<T | null>(null);
  const [outside, setOutside] = useState(startOff);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => setOutside(!e.isIntersecting), { rootMargin });
      io.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
    };
  }, [rootMargin]);
  return [ref, outside || hidden] as const;
}
