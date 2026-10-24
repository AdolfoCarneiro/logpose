import { test } from "node:test";
import assert from "node:assert/strict";
import { toItems, toNavigation } from "./tabs-model.js";

test("fixadas primeiro, depois por index", () => {
  const tabs = [
    { id: 3, index: 2, title: "c", url: "https://c", pinned: false },
    { id: 1, index: 0, title: "a", url: "https://a", pinned: true },
    { id: 2, index: 1, title: "b", url: "https://b", pinned: false },
  ];
  assert.deepEqual(toItems(tabs, 2).map((t) => [t.id, t.active]), [[1, false], [2, true], [3, false]]);
});

test("título vazio cai pra URL", () => {
  const [item] = toItems([{ id: 1, index: 0, title: "", url: "https://x.dev/a", pinned: false }], 1);
  assert.equal(item.title, "https://x.dev/a");
});

test("navegação: URL com esquema", () => {
  assert.deepEqual(toNavigation("https://a.dev/x"), { kind: "url", url: "https://a.dev/x" });
});

test("navegação: domínio sem esquema vira https", () => {
  assert.deepEqual(toNavigation("github.com/taigakilla"), { kind: "url", url: "https://github.com/taigakilla" });
});

test("navegação: localhost com porta", () => {
  assert.deepEqual(toNavigation("localhost:5173"), { kind: "url", url: "http://localhost:5173" });
});

test("navegação: texto com espaço é busca", () => {
  assert.deepEqual(toNavigation("material 3 expressive"), { kind: "search", text: "material 3 expressive" });
});

test("navegação: palavra solta é busca", () => {
  assert.deepEqual(toNavigation("helium"), { kind: "search", text: "helium" });
});

test("aba carregando usa a URL pendente como título", () => {
  const [item] = toItems([{ id: 1, index: 0, title: "", url: "", pendingUrl: "https://m3.material.io/", pinned: false }], 1);
  assert.equal(item.title, "https://m3.material.io/");
  assert.equal(item.url, "https://m3.material.io/");
});
