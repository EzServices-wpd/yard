import { useEffect, useRef, useState } from "react";

/** True while the element is fully off screen, so CSS motion can pause (animation-play-state) and cost nothing. */
export function useOffscreen<T extends Element>(rootMargin = "0px") {
  const ref = useRef<T | null>(null);
  const [off, setOff] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOff(!e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, off] as const;
}
