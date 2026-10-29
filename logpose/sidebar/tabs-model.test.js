import { test } from "node:test";
import assert from "node:assert/strict";
import { toItems, toNavigation, splitEdges, faviconOf } from "./tabs-model.js";

test("fixadas primeiro, depois por index", () => {
  const tabs = [
    { id: 3, index: 2, title: "c", url: "https://c", pinned: false },
    { id: 1, index: 0, title: "a", url: "https://a", pinned: true },
    { id: 2, index: 1, title: "b", url: "https://b", pinned: false },
  ];
  assert.deepEqual(toItems(tabs, 2).map((t) => [t.id, t.active]), [[1, false], [2, true], [3, false]]);
});

test("título vazio cai pra URL", () => {
  const [named] = toItems([{ id: 1, index: 0, title: "Página", url: "https://x.dev/a" }], 1, (t) => (t.id === 1 ? "Meu nome" : ""));
  assert.equal(named.title, "Meu nome");
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

test("aba carregando é marcada", () => {
  const [a, b] = toItems([
    { id: 1, index: 0, title: "a", url: "https://a", status: "loading", pinned: false },
    { id: 2, index: 1, title: "b", url: "https://b", status: "complete", pinned: false },
  ], 1);
  assert.equal(a.loading, true);
  assert.equal(b.loading, false);
});

test("aba dormindo é marcada", () => {
  const [a] = toItems([{ id: 1, index: 0, title: "a", url: "https://a", discarded: true, pinned: false }], 2);
  assert.equal(a.asleep, true);
});

test("aba tocando som ou silenciada é marcada", () => {
  const tabs = [
    { id: 1, index: 0, audible: true, url: "https://a.dev/" },
    { id: 2, index: 1, audible: true, mutedInfo: { muted: true }, url: "https://b.dev/" },
    { id: 3, index: 2, url: "https://c.dev/" },
  ];
  assert.deepEqual(toItems(tabs, 1).map((t) => t.audio), ["playing", "muted", ""]);
});

test("navegação: logpose:// vira a página interna", () => {
  assert.deepEqual(toNavigation("logpose://extensions"), { kind: "url", url: "chrome://extensions" });
  assert.deepEqual(toNavigation("logpose://settings/privacy"), { kind: "url", url: "chrome://settings/privacy" });
  assert.deepEqual(toNavigation("logpose://settings"), { kind: "url", url: "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html" });
  assert.deepEqual(toNavigation("chrome://settings/"), { kind: "url", url: "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html" });
  assert.deepEqual(toNavigation("logpose://configurações"), { kind: "url", url: "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html" });
});

test("título que é URL interna aparece como logpose://", () => {
  const [item] = toItems([{ id: 1, index: 0, url: "chrome://extensions/", title: "" }], 1);
  assert.equal(item.title, "logpose://extensions/");
});

test("abas em tela dividida ficam juntas", () => {
  const items = toItems([
    { id: 1, index: 0, url: "a", splitViewId: -1 },
    { id: 2, index: 1, url: "b", splitViewId: 7 },
    { id: 3, index: 2, url: "c", splitViewId: 7 },
    { id: 4, index: 3, url: "d" },
  ], 2);
  assert.deepEqual(items.map((i) => i.split), [null, 7, 7, null]);
  assert.deepEqual(splitEdges(items), ["", "first", "last", ""]);
});

test("página de extensão sem favicon usa o ícone da extensão", () => {
  const icon = faviconOf({ url: "chrome-extension://abc/dashboard.html", favIconUrl: "chrome-extension://abc/img/icon.svg" });
  assert.match(icon, /\/_favicon\/\?pageUrl=chrome-extension%3A%2F%2Fabc%2Fdashboard\.html&size=32$/);
  assert.equal(faviconOf({ url: "https://a.com/", favIconUrl: "https://a.com/f.ico" }), "https://a.com/f.ico");
  assert.equal(faviconOf({ url: "https://a.com/" }), "");
  const own = "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html";
  assert.equal(faviconOf({ url: own, favIconUrl: "x.svg" }), "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/icon-128.png");
});

test("páginas internas usam o ícone do Log Pose", () => {
  const icon = "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/icon-128.png";
  assert.equal(faviconOf({ url: "chrome://history/", favIconUrl: "chrome://favicon/x" }), icon);
  assert.equal(faviconOf({ url: "logpose://settings" }), icon);
  assert.equal(faviconOf({ url: "about:blank", favIconUrl: "" }), "");
});

test("aba em ilha leva o groupId; sem ilha, null", () => {
  const [a, b] = toItems([{ id: 1, index: 0, url: "https://a", groupId: 9 }, { id: 2, index: 1, url: "https://b", groupId: -1 }], 1);
  assert.equal(a.group, 9);
  assert.equal(b.group, null);
});
