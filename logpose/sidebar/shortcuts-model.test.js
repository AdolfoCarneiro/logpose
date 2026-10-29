import { test } from "node:test";
import assert from "node:assert/strict";
import { SHORTCUTS, fromEvent, current, assign, reset, toMap, label } from "./shortcuts-model.js";

const key = (code, mods = {}) => ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });

test("os padrões não repetem teclas", () => {
  const keys = SHORTCUTS.map((s) => s.keys).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length);
});

test("grava a tecla pelo código físico, na ordem Ctrl, Alt, Shift, Super", () => {
  assert.equal(fromEvent(key("KeyC", { ctrlKey: true, shiftKey: true })), "Ctrl+Shift+C");
  assert.equal(fromEvent(key("Equal", { ctrlKey: true, shiftKey: true })), "Ctrl+Shift+=");
  assert.equal(fromEvent(key("ArrowRight", { altKey: true, shiftKey: true })), "Alt+Shift+Right");
  assert.equal(fromEvent(key("Digit3", { metaKey: true, altKey: true })), "Alt+Super+3");
  assert.equal(fromEvent(key("F5")), "F5");
});

test("sem Ctrl, Alt ou Super não vale (só F1–F24), e tecla de modificador sozinha também não", () => {
  assert.equal(fromEvent(key("KeyA")), null);
  assert.equal(fromEvent(key("KeyA", { shiftKey: true })), null);
  assert.equal(fromEvent(key("ControlLeft", { ctrlKey: true })), null);
});

test("trocar a tecla tira ela de quem já tinha", () => {
  const stored = assign({}, "archive", "Ctrl+D");
  const list = current(stored);
  assert.equal(list.find((s) => s.command === "archive").keys, "Ctrl+D");
  assert.equal(list.find((s) => s.command === "pinTab").keys, "");
  assert.equal(toMap(stored)["Ctrl+D"], "archive");
});

test("restaurar o padrão volta a tecla e tira de quem pegou", () => {
  const taken = assign({}, "archive", "Ctrl+D");
  const back = reset(taken, "pinTab");
  assert.equal(toMap(back)["Ctrl+D"], "pinTab");
  assert.equal(current(back).find((s) => s.command === "archive").keys, "");
});

test("apagar deixa o comando sem tecla e fora do mapa", () => {
  const stored = assign({}, "settings", "");
  assert.equal(Object.values(toMap(stored)).includes("settings"), false);
});

test("rótulo em pedaços, com setas", () => {
  assert.deepEqual(label("Alt+Shift+Right"), ["Alt", "Shift", "→"]);
  assert.deepEqual(label(""), []);
});
