import { test } from "node:test";
import assert from "node:assert/strict";
import { others, pinnedIds, pinnedActions, togglePin, MAX_DEFAULT_PINS } from "./extensions-model.js";

const actions = [
  { id: "ublock", name: "uBlock Origin" },
  { id: "logpose", name: "Log Pose — barra lateral" },
  { id: "onepassword", name: "1Password" },
  { id: "dark", name: "Dark Reader" },
];

test("a própria barra lateral não aparece e a lista vem em ordem alfabética", () => {
  assert.deepEqual(others(actions, "logpose").map((a) => a.id), ["onepassword", "dark", "ublock"]);
});

test("sem escolha salva, as primeiras extensões ficam fixadas", () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, name: `E${i}` }));
  assert.equal(pinnedIds(undefined, list).length, MAX_DEFAULT_PINS);
  assert.deepEqual(pinnedIds([], list), []);
  assert.deepEqual(pinnedIds(["e5"], list), ["e5"]);
});

test("fixadas seguem a ordem salva e ignoram extensões removidas", () => {
  assert.deepEqual(pinnedActions(actions, ["dark", "sumiu", "ublock"]).map((a) => a.id), ["dark", "ublock"]);
});

test("fixar e desafixar", () => {
  assert.deepEqual(togglePin(["a"], "b"), ["a", "b"]);
  assert.deepEqual(togglePin(["a", "b"], "a"), ["b"]);
});
