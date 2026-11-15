// 3D-тур агента → сторінка тесту. Контракт із фічею experiment-3d — без імпортів між фічами:
// спец у sessionStorage, `?tour=<id>` в URL і подія window `agent:tour` (docs/agent/ui-actions.md).
import type { Tour } from "../types.ts";

export const TOUR_EVENT = "agent:tour";
export const OPEN_EVENT = "agent:open";
export const tourKey = (id: string) => `flame.tour.${id}`;

export function tourHref(tour: Pick<Tour, "id" | "test_no">): string {
  return `/studies/flex/tests/${tour.test_no}?view=3d&tour=${encodeURIComponent(tour.id)}#tp-media`;
}

/** Чи відкрита вже сторінка цього тесту з 3D-replay: тоді тур стартує подією, без навігації. */
export function onTourPage(pathname: string, search: string, testNo: number): boolean {
  return pathname.replace(/\/$/, "") === `/studies/flex/tests/${testNo}` && new URLSearchParams(search).get("view") === "3d";
}

export function saveTour(storage: Pick<Storage, "setItem"> | undefined, tour: Tour): boolean {
  try {
    storage?.setItem(tourKey(tour.id), JSON.stringify(tour));
    return storage != null;
  } catch {
    return false; // приватний режим або повне сховище: туру не буде, відповідь лишається
  }
}
