import { Component, lazy, useMemo, type ReactNode } from "react";
import { useSaffireDashboard, useSaffireSeriesMany } from "@/features/saffire2";
import { buildModel, type SaffireModel } from "../lib/model";

// three.js is a separate chunk: it loads only when a 3D view is on the page
export const Scene = lazy(() => import("./Scene").then((m) => ({ default: m.Scene })));

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const IDS = ["2-1", "2-2", "2-3", "2-4", "2-5", "2-6", "2-7", "2-8", "2-9"];

export type ModelState =
  | { status: "pending" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; model: SaffireModel; dash: NonNullable<ReturnType<typeof useSaffireDashboard>["data"]> };

/** Dashboard + all nine series (shared TanStack cache) → scene model. */
export function useSaffireModel(): ModelState {
  const dash = useSaffireDashboard();
  const series = useSaffireSeriesMany(IDS);
  const ready = !!dash.data && series.every((q) => q.data);
  const stamp = series.map((q) => q.dataUpdatedAt).join();
  const model = useMemo(
    () => (ready ? buildModel(dash.data!, series.map((q) => q.data!)) : null),
    // rebuild only when the data itself changed (the query array is new on every render)
    [ready, dash.data, stamp], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (dash.isError || series.some((q) => q.isError)) return { status: "error" };
  if (!ready) return { status: "pending" };
  if (!model) return { status: "empty" };
  return { status: "ready", model, dash: dash.data! };
}
