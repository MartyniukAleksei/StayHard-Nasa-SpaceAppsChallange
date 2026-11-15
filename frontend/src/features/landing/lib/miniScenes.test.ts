import { test } from "node:test";
import assert from "node:assert/strict";
import { MINI } from "./miniScenes.ts";

test("every mini scene draws something and stays in [0, 1]", () => {
  for (const [name, { scene }] of Object.entries(MINI)) {
    let lit = 0;
    for (let t = 0; t < 6; t += 0.5)
      for (let x = -0.8; x <= 0.8; x += 0.02)
        for (let y = -0.5; y <= 0.5; y += 0.02) {
          const { v } = scene(x, y, t);
          assert.ok(v >= 0 && v <= 1, `${name} v=${v}`);
          if (v > 0.1) lit++;
        }
    assert.ok(lit > 0, `${name} is blank`);
  }
});
