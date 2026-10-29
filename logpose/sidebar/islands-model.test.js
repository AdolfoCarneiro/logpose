import { test } from "node:test";
import assert from "node:assert/strict";
import { ISLAND_ORDER, nextColor, islandLabel, islandEdges, visibleItems, neighborOutside, dropTarget, strayTabs } from "./islands-model.js";

test("próxima cor pula as usadas", () => {
  assert.equal(nextColor([]), "blue");
  assert.equal(nextColor([{ color: "blue" }, { color: "yellow" }]), "green");
});

test("todas usadas, gira", () => {
  assert.equal(nextColor(ISLAND_ORDER.map((color) => ({ color }))), "blue");
});

test("rótulo: título ou cor por extenso", () => {
  assert.equal(islandLabel({ title: " Viagem ", color: "red" }), "Viagem");
  assert.equal(islandLabel({ title: "", color: "green" }), "Ilha verde");
});

test("bordas do bloco", () => {
  const g = (...ids) => ids.map((group) => ({ group }));
  assert.deepEqual(islandEdges(g(null, 1, 1, 1, null, 2)), ["", "first", "middle", "last", "", "only"]);
  assert.deepEqual(islandEdges(g(1, 2)), ["only", "only"]);
});

test("ilha recolhida some da lista", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: 7 }];
  assert.deepEqual(visibleItems(items, new Set([7])).map((i) => i.id), [1]);
});

test("vizinha fora da ilha: depois, senão antes, senão null", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: 7 }, { id: 4, group: null }];
  assert.equal(neighborOutside(items, 7, 2), 4);
  assert.equal(neighborOutside(items.slice(0, 3), 7, 3), 1);
  assert.equal(neighborOutside(items.slice(1, 3), 7, 2), null);
});

test("soltar no meio da ilha entra", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: 7 }];
  assert.deepEqual(dropTarget(items, 0, 1), { join: 7 });
});

test("soltar fora sai", () => {
  const items = [{ id: 1, group: 7 }, { id: 2, group: 7 }, { id: 3, group: null }, { id: 4, group: null }];
  assert.deepEqual(dropTarget(items, 0, 3), { join: null });
});

test("última aba da ilha arrastada pra fora sai", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: null }];
  assert.deepEqual(dropTarget(items, 1, 2), { join: null });
  assert.deepEqual(dropTarget(items, 1, 0), { join: null });
});

test("reordenar dentro da ilha continua nela", () => {
  const items = [{ id: 1, group: 7 }, { id: 2, group: 7 }, { id: 3, group: 7 }];
  assert.deepEqual(dropTarget(items, 0, 2), { join: 7 });
});

test("aba de outro espaço na ilha é intrusa", () => {
  const space = { 1: "a", 2: "a", 3: "b", 4: "b" };
  const tabs = [{ id: 1, groupId: 7 }, { id: 2, groupId: 7 }, { id: 3, groupId: 7 }, { id: 4, groupId: -1 }];
  assert.deepEqual(strayTabs(tabs, (id) => space[id]), [3]);
});

test("aba nova do mesmo espaço na ilha não é intrusa", () => {
  const tabs = [{ id: 1, groupId: 7 }, { id: 2, groupId: 7 }];
  assert.deepEqual(strayTabs(tabs, () => "a"), []);
});
