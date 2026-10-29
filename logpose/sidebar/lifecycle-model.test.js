import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, archiveEntry, pushArchive } from "./lifecycle-model.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const now = 100 * HOUR;
const tab = (id, minutesAgo, extra = {}) => ({ id, lastAccessed: now - minutesAgo * MIN, url: `https://t${id}.dev/`, title: `t${id}`, ...extra });

test("dorme quem passou do tempo, menos ativa, tocando áudio e já dormindo", () => {
  const tabs = [tab(1, 40), tab(2, 10), tab(3, 40, { active: true }), tab(4, 40, { audible: true }), tab(5, 40, { discarded: true })];
  assert.deepEqual(plan(tabs, now, { sleepAfterMinutes: 30, archiveAfterHours: 12 }).sleep, [1]);
});

test("arquiva quem passou das horas, nunca fixadas nem a ativa", () => {
  const tabs = [tab(1, 13 * 60), tab(2, 13 * 60, { pinned: true }), tab(3, 13 * 60, { active: true }), tab(4, 2 * 60)];
  const result = plan(tabs, now, { sleepAfterMinutes: 30, archiveAfterHours: 12 });
  assert.deepEqual(result.archive, [1]);
  assert.ok(!result.sleep.includes(1));
});

test("abas da seção Fixadas não são arquivadas, só dormem", () => {
  const tabs = [tab(1, 13 * 60), tab(2, 13 * 60)];
  const result = plan(tabs, now, { sleepAfterMinutes: 30, archiveAfterHours: 12 }, new Set([2]));
  assert.deepEqual(result.archive, [1]);
  assert.deepEqual(result.sleep, [2]);
});

test("zero desliga cada etapa", () => {
  const tabs = [tab(1, 13 * 60)];
  assert.deepEqual(plan(tabs, now, { sleepAfterMinutes: 0, archiveAfterHours: 0 }), { sleep: [], archive: [] });
});

test("aba sem lastAccessed não é tocada", () => {
  assert.deepEqual(plan([{ id: 9, url: "https://x.dev/" }], now, { sleepAfterMinutes: 30, archiveAfterHours: 12 }), { sleep: [], archive: [] });
});

test("páginas internas e abas vazias não vão pro arquivo", () => {
  const tabs = [tab(1, 13 * 60, { url: "chrome://newtab/" }), tab(2, 13 * 60, { url: "" })];
  assert.deepEqual(plan(tabs, now, { sleepAfterMinutes: 30, archiveAfterHours: 12 }).archive, []);
});

test("entrada do arquivo guarda o necessário pra reabrir", () => {
  const entry = archiveEntry(tab(1, 0, { favIconUrl: "https://t1.dev/f.png" }), "trabalho", now);
  assert.deepEqual(entry, { url: "https://t1.dev/", title: "t1", favIconUrl: "https://t1.dev/f.png", space: "trabalho", archivedAt: now });
});

test("arquivo mais novo primeiro, com limite", () => {
  const old = Array.from({ length: 5 }, (_, i) => ({ url: `https://o${i}.dev/`, archivedAt: i }));
  const merged = pushArchive(old, [{ url: "https://n.dev/", archivedAt: 99 }], 4);
  assert.equal(merged.length, 4);
  assert.equal(merged[0].url, "https://n.dev/");
});
