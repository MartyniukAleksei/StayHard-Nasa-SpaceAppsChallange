import { useEffect, useState } from "react";

/** A heading counts as "current" once its top passes this line from the top of the screen, px. */
const LINE = 140;

function currentSection(): string | null {
  // h2 = page sections ("Watch", "Droplet: the d² law"); above the first one there is no section
  let current: string | null = null;
  for (const h of document.querySelectorAll("main h2")) {
    if (h.getBoundingClientRect().top <= LINE) current = h.textContent?.trim() || current;
    else break;
  }
  return current;
}

/** Heading of the page section the user is looking at; updates on scroll and navigation. */
export function useVisibleSection(routeKey: string): string | null {
  const [section, setSection] = useState<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSection(currentSection()));
    };
    update();
    // pages render their data after navigation; re-read when the DOM settles
    const obs = new MutationObserver(update);
    const main = document.querySelector("main");
    if (main) obs.observe(main, { childList: true, subtree: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [routeKey]);
  return section;
}
