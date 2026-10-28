import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ALIASES, loadAliases, parseAlias, aliasUrl, aliasName, validAlias } from "./aliases-model.js";

test("sem nada salvo vêm os aliases padrão; lista salva vazia continua vazia", () => {
  assert.deepEqual(loadAliases(undefined).map((a) => a.alias), ["a", "f", "h", "yt", "gg", "dg"]);
  assert.deepEqual(loadAliases([]), []);
});

test("alias inválido ou repetido sai da lista", () => {
  const list = loadAliases([
    { alias: "a", scope: "tabs" },
    { alias: "A", scope: "history" },
    { alias: "x y", scope: "tabs" },
    { alias: "w", scope: "nada" },
    { alias: "wp", name: "Wikipedia", url: "https://pt.wikipedia.org/w/index.php?search=%s" },
    { alias: "js", name: "JS", url: "javascript:alert(%s)" },
    { alias: "sem", name: "Sem termo", url: "https://exemplo.com/" },
  ]);
  assert.deepEqual(list.map((a) => a.alias), ["a", "wp"]);
});

test("alias seguido de espaço vira o escopo e o resto vira a busca", () => {
  assert.deepEqual(parseAlias("a board", DEFAULT_ALIASES), { alias: DEFAULT_ALIASES[0], rest: "board" });
  assert.deepEqual(parseAlias("F repos", DEFAULT_ALIASES), { alias: DEFAULT_ALIASES[1], rest: "repos" });
  assert.equal(parseAlias("yt ", DEFAULT_ALIASES).rest, "");
  assert.equal(parseAlias("a", DEFAULT_ALIASES), null);
  assert.equal(parseAlias("abacate maduro", DEFAULT_ALIASES), null);
});

test("busca em site monta a URL com os termos", () => {
  assert.equal(aliasUrl(DEFAULT_ALIASES[3], " lofi beats "), "https://www.youtube.com/results?search_query=lofi%20beats");
  assert.equal(aliasName(DEFAULT_ALIASES[0]), "Abas");
  assert.equal(aliasName(DEFAULT_ALIASES[4]), "Google");
  assert.ok(validAlias({ alias: "gh", name: "GitHub", url: "https://github.com/search?q=%s" }));
});
