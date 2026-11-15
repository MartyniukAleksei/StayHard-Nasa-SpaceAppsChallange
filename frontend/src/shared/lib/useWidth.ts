import { useLayoutEffect, useRef, useState } from "react";

/** Element content width, kept in sync with ResizeObserver (for crisp SVG text). */
export function useWidth<T extends Element>(initial = 600, min = 240) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}
