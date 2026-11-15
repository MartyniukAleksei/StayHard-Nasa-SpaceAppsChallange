// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseLog } from "./log.ts";

// Lines copied from data/flex/raw/100/C09H101.txt (FLEX-100)
const LOG = `Test Point:\t\t\t\tC09H101
Igniter On Time (milliseconds):\t\t1300
AS Dispense Start:\t\t\t
AS Needles Retract:\t\t\t2010-06-29 08:30:46.767
AS Crew Light:\t\t\t\t2010-06-29 08:30:46.783
AS Burn to Completion/Igniter On:\t2010-06-29 08:30:46.883
AS Igniter Off/Retract Start:\t\t2010-06-29 08:30:48.187
AS Retract Completed:\t\t\t2010-06-29 08:30:48.590
AS Completed:\t\t\t\t2010-06-29 08:31:46.673
`;

const near = (a: number | null, b: number) => assert.ok(a != null && Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

describe("parseLog", () => {
  test("zero of time is the igniter-off line", () => {
    assert.equal(parseLog(LOG).ignitionEpochMs, Date.parse("2010-06-29T08:30:48.187Z"));
  });
  test("hardware events are seconds relative to ignition", () => {
    const { events } = parseLog(LOG);
    near(events.needlesRetract, -1.42);
    near(events.igniterOn, -1.304);
    near(events.igniterRetracted, 0.403);
  });
  test("an empty stamp is not read from the next line", () => {
    const log = "AS Needles Retract:\t\t\t\nAS Igniter Off/Retract Start:\t2010-06-29 08:30:48.187\n";
    assert.equal(parseLog(log).events.needlesRetract, null);
  });
  test("a log without the zero line gives nothing", () => {
    const t = parseLog("AS Needles Retract:\t2010-06-29 08:30:46.767\n");
    assert.equal(t.ignitionEpochMs, null);
    assert.equal(t.events.needlesRetract, null);
  });
});
