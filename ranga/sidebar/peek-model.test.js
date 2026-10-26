import { test } from "node:test";
import assert from "node:assert/strict";
import { windowFromHash, toolbarRect, pageLabel, peekTabs, TOOLBAR_HEIGHT, TOOLBAR_GAP } from "./peek-model.js";

test("janela vem do hash do overlay", () => {
  assert.equal(windowFromHash("#123-4"), 123);
  assert.equal(windowFromHash("123-1"), 123);
  assert.equal(windowFromHash("#idle-0"), null);
  assert.equal(windowFromHash(""), null);
  assert.equal(windowFromHash(undefined), null);
});

test("barra fica logo acima do cartão, da mesma largura", () => {
  const card = { x: 40, y: 56, width: 800, height: 600 };
  assert.deepEqual(toolbarRect(card), { left: 40, top: 56 - TOOLBAR_HEIGHT - TOOLBAR_GAP, width: 800, height: TOOLBAR_HEIGHT });
});

test("barra nunca sai pelo topo", () => {
  assert.equal(toolbarRect({ x: 0, y: 10, width: 100, height: 100 }).top, 0);
});

test("título da Peek cai pro domínio quando não há título", () => {
  assert.deepEqual(pageLabel({ url: "https://www.example.com/a", title: "Exemplo" }), { title: "Exemplo", host: "example.com" });
  assert.deepEqual(pageLabel({ url: "https://www.example.com/a", title: "" }), { title: "example.com", host: "example.com" });
  assert.deepEqual(pageLabel({ url: "https://example.com/a", title: "https://example.com/a" }), { title: "example.com", host: "example.com" });
  assert.deepEqual(pageLabel({ url: "", title: "" }), { title: "Nova página", host: "" });
});

test("abas da Peek: as fixadas abertas, ou nenhuma com a opção desligada", () => {
  assert.deepEqual(peekTabs({ 12: "pin-a", 3: "pin-b" }, true), [3, 12]);
  assert.deepEqual(peekTabs({ 12: "pin-a" }, false), []);
  assert.deepEqual(peekTabs(undefined, true), []);
  assert.deepEqual(peekTabs({ x: "pin" }, true), []);
});
