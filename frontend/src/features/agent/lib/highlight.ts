// Підсвічування параметрів на сторінці: сторінки позначають значення атрибутами
// data-field="p_atm" (кілька — через пробіл) і data-test="19" на контейнері тесту.
// Фіча agent лише додає клас — жодних імпортів зі сторінок.

export const HL_CLASS = "ag-hl";

export function clearHighlight(root: ParentNode = document): void {
  root.querySelectorAll(`.${HL_CLASS}`).forEach((el) => el.classList.remove(HL_CLASS));
}

export function applyHighlight(fields: string[], testNos: number[], root: ParentNode = document): Element[] {
  clearHighlight(root);
  const scope = root.querySelector("main") ?? root;
  const hits: Element[] = [];
  for (const f of fields) {
    scope.querySelectorAll(`[data-field~="${CSS.escape(f)}"]`).forEach((el) => {
      const owner = el.closest("[data-test]")?.getAttribute("data-test");
      if (testNos.length && owner && !testNos.includes(Number(owner))) return;
      el.classList.add(HL_CLASS);
      hits.push(el);
    });
  }
  return hits;
}

// --- jump to a cited place (NotebookLM-style) ------------------------------------------------

const QUOTE_HL = "ag-quote";
const WAIT_MS = 4000;
/** Charts, video and replays load after the page and push content down: re-check the target. */
const SETTLE_MS = [400, 1000, 2000, 3500];

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isVisible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

/** Scroll an element to the middle of the screen if it is not already fully visible. */
export function revealElement(el: Element): void {
  if (!isVisible(el)) el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
}

/**
 * Reveal now and keep it in view while the page is still loading around it, until the user
 * scrolls or types themselves. Returns a cancel function.
 */
function revealAndHold(el: Element): () => void {
  revealElement(el);
  const timers = SETTLE_MS.map((ms) => window.setTimeout(() => el.isConnected && revealElement(el), ms));
  const stop = () => {
    timers.forEach((t) => window.clearTimeout(t));
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchmove", stop);
    window.removeEventListener("keydown", stop);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchmove", stop, { passive: true });
  window.addEventListener("keydown", stop);
  return stop;
}

export function clearQuote(): void {
  CSS.highlights?.delete(QUOTE_HL);
  document.querySelectorAll(".ag-hl-block").forEach((el) => el.classList.remove("ag-hl-block"));
}

/** Highlight `text` inside `root` without touching the DOM (CSS Custom Highlight API). */
function highlightText(root: Element, text: string): boolean {
  const needle = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!needle) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const hay = (node.textContent ?? "").toLowerCase();
    // the quote may be a slice of a longer comment; try the whole quote, then its first 60 chars
    for (const probe of [needle, needle.slice(0, 60)]) {
      const at = hay.indexOf(probe);
      if (at < 0) continue;
      if (!("highlights" in CSS) || typeof Highlight === "undefined") return false;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, Math.min(hay.length, at + needle.length));
      CSS.highlights.set(QUOTE_HL, new Highlight(range));
      return true;
    }
  }
  return false;
}

export type FocusTarget = { fields: string[]; test_nos: number[]; text?: string; anchor?: string; section?: string };

/** What on the current page answers this target, or null when it has not rendered yet. */
function locate(t: FocusTarget): Element | null {
  const main = document.querySelector("main") ?? document;
  if (t.text && t.anchor) {
    const block = main.querySelector(`[data-source="${t.anchor}"]`);
    if (block) return block;
  }
  if (t.fields.length) {
    const hits = applyHighlight(t.fields, t.test_nos);
    if (hits.length) return hits[0];
  }
  return t.section ? document.getElementById(t.section) : null;
}

/**
 * Show a cited place on the page: wait until it renders (data loads after navigation),
 * highlight the fields or the quoted phrase, scroll it into view. Returns a cancel function.
 */
export function focusOnPage(t: FocusTarget): () => void {
  clearHighlight();
  clearQuote();
  let done = false;
  let release: () => void = () => {};
  const tryNow = () => {
    if (done) return;
    const el = locate(t);
    if (!el) return;
    done = true;
    obs.disconnect();
    window.clearTimeout(timer);
    if (t.text && t.anchor && el.matches(`[data-source="${t.anchor}"]`) && !highlightText(el, t.text)) {
      el.classList.add("ag-hl-block");
    }
    release = revealAndHold(el);
  };
  const obs = new MutationObserver(tryNow);
  obs.observe(document.body, { childList: true, subtree: true });
  const timer = window.setTimeout(() => {
    done = true;
    obs.disconnect();
  }, WAIT_MS);
  tryNow();
  return () => {
    done = true;
    obs.disconnect();
    window.clearTimeout(timer);
    release();
  };
}
