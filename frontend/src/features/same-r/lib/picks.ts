import type { TestGroup } from "./tests.ts";

const rt = (g: TestGroup) => (typeof g.main.heater_rt_r0 === "number" ? g.main.heater_rt_r0 : null);

/** Similar tests (derived): same material, closest heater level, then closest test number. */
export function similar(groups: TestGroup[], g: TestGroup, n = 4): TestGroup[] {
  const h = rt(g);
  const gap = (o: TestGroup) => (h == null || rt(o) == null ? Infinity : Math.abs(rt(o)! - h));
  return groups
    .filter((o) => o.test_no !== g.test_no && o.main.material === g.main.material)
    .sort((a, b) => gap(a) - gap(b) || Math.abs(a.test_no - g.test_no) - Math.abs(b.test_no - g.test_no))
    .slice(0, n);
}

export type Pick = { id: string; title: string; why: string; g: TestGroup };

/**
 * "Tests to read first" (derived): for each feature worth seeing, the first test with telemetry that has it.
 * Picked from the data, so the page never names a test that lacks the feature.
 */
export function readFirst(groups: TestGroup[], ptrakLimit: number): Pick[] {
  const live = groups.filter((g) => g.main.has_timeseries);
  const rules: (Omit<Pick, "g"> & { test: (g: TestGroup) => boolean })[] = [
    { id: "aged", title: "Smoke measured twice", why: "Measured right away and again after aging in the chamber.", test: (g) => g.aged != null },
    { id: "tem", title: "Particles under the microscope", why: "Smoke particles from this run were imaged with TEM.", test: (g) => g.main.has_tem === true },
    {
      id: "limit",
      title: "Particle counter at its limit",
      why: "The P-Trak count reached the instrument's upper limit: the true count was at least this high.",
      test: (g) => (g.main.ptrak_peak_per_cc ?? 0) >= ptrakLimit,
    },
    { id: "sts", title: "Shuttle smoke detector", why: "The Space Shuttle (STS) ionization detector was active in this run.", test: (g) => (g.main.active_detectors ?? []).some((d) => d.startsWith("sts")) },
  ];
  const used = new Set<number>();
  return rules.flatMap(({ test, ...r }) => {
    const g = live.find((x) => test(x) && !used.has(x.test_no));
    if (!g) return [];
    used.add(g.test_no);
    return [{ ...r, g }];
  });
}
