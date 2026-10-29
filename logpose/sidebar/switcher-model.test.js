import { test } from "node:test";
import assert from "node:assert/strict";
import { recentTabs, step } from "./switcher-model.js";

test("aba ativa primeiro, depois as usadas mais recentemente", () => {
  const tabs = [
    { id: 1, active: false, lastAccessed: 100 },
    { id: 2, active: true, lastAccessed: 50 },
    { id: 3, active: false, lastAccessed: 300 },
    { id: 4, active: false },
  ];
  assert.deepEqual(recentTabs(tabs).map((t) => t.id), [2, 3, 1, 4]);
  assert.equal(recentTabs(tabs, 2).length, 2);
});

test("seleção dá a volta nas duas direções", () => {
  assert.equal(step(0, 4, 1), 1);
  assert.equal(step(3, 4, 1), 0);
  assert.equal(step(0, 4, -1), 3);
  assert.equal(step(0, 0, 1), 0);
});
