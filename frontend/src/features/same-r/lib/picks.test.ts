import assert from "node:assert/strict";
import { test } from "node:test";
import { readFirst, similar } from "./picks.ts";
import type { TestGroup } from "./tests.ts";

const g = (test_no: number, material: string, heater_rt_r0: number | null, extra: Record<string, unknown> = {}, aged = false): TestGroup =>
  ({
    test_no,
    main: { test_no, test_id: String(test_no), material, heater_rt_r0, has_timeseries: true, ...extra },
    aged: aged ? { test_no, test_id: `${test_no}a` } : null,
  }) as unknown as TestGroup;

test("similar: same material only, closest heater level first, then closest number", () => {
  const all = [g(1, "Kapton", 1.38), g(2, "Kapton", 1.48), g(3, "Teflon", 1.38), g(4, "Kapton", 1.38), g(9, "Kapton", 1.38)];
  assert.deepEqual(similar(all, all[0]).map((x) => x.test_no), [4, 9, 2]);
  assert.deepEqual(similar(all, all[2]), []);
});

test("readFirst: one distinct test per feature, only tests with telemetry", () => {
  const all = [
    g(1, "Kapton", 1.38, { has_timeseries: false }, true),
    g(2, "Kapton", 1.38, { has_tem: true }, true),
    g(3, "Teflon", 1.38, { has_tem: true, ptrak_peak_per_cc: 500000 }),
    g(4, "Teflon", 1.38, { active_detectors: ["sts_v"] }),
  ];
  assert.deepEqual(readFirst(all, 500000).map((p) => [p.id, p.g.test_no]), [["aged", 2], ["tem", 3], ["sts", 4]]);
});
