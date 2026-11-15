import { lazy, Suspense } from "react";

// Loaded on demand: the page carries its own images and styles, which other pages do not need.
const CfigStudy = lazy(() => import("@/features/cfig-cool").then((m) => ({ default: m.CfigStudy })));

export function CfigPage() {
  return (
    <Suspense fallback={<div className="wrap"><p className="mono small">Loading …</p></div>}>
      <CfigStudy />
    </Suspense>
  );
}
