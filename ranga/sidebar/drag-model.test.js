import { test } from "node:test";
import assert from "node:assert/strict";
import { windowAt, chromeWindowFor, zonesFor } from "./drag-model.js";

const windows = [
  { title: "WhatsApp - Ranga", x: 0, y: 0, width: 1000, height: 800 },
  { title: "Gmail - Ranga", x: 1000, y: 0, width: 900, height: 800 },
];

test("acha a janela do Ranga sob o cursor, a mais recente primeiro", () => {
  assert.equal(windowAt({ x: 400, y: 300 }, windows).title, "WhatsApp - Ranga");
  assert.equal(windowAt({ x: 1200, y: 300 }, windows).title, "Gmail - Ranga");
  assert.equal(windowAt({ x: 2400, y: 300 }, windows), null);
});

test("liga a janela do Hyprland à do navegador pelo título da aba ativa, só sem ambiguidade", () => {
  const chrome = [{ id: 1, title: "WhatsApp" }, { id: 2, title: "Gmail" }];
  assert.equal(chromeWindowFor(windows[1], chrome).id, 2);
  assert.equal(chromeWindowFor(windows[0], [...chrome, { id: 3, title: "WhatsApp" }]), null);
});

test("na própria janela divide com a aba da tela; noutra, divide ou entra nela", () => {
  const dragged = { id: 5, splitViewId: -1 };
  assert.equal(zonesFor({ dragged, partner: { id: 6, splitViewId: -1 }, own: true }), "left,right,top,bottom,window");
  assert.equal(zonesFor({ dragged, partner: { id: 5, splitViewId: -1 }, own: true }), "window");
  assert.equal(zonesFor({ dragged, partner: { id: 6, splitViewId: 9 }, own: true }), "window");
  assert.equal(zonesFor({ dragged, partner: { id: 7, splitViewId: -1 }, own: false }), "left,right,top,bottom,join");
  assert.equal(zonesFor({ dragged, partner: { id: 7, splitViewId: 3 }, own: false }), "join");
});
