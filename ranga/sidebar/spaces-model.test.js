import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState, createSpace, renameSpace, deleteSpace, assignTab, forgetTab,
  spaceOfTab, visibleTabs, setActive, activeSpace, neighborSpace, rememberTab, updateSpace, snapshot, restore,
} from "./spaces-model.js";

const tabs = [
  { id: 1, index: 0 },
  { id: 2, index: 1 },
  { id: 3, index: 2 },
];

test("estado inicial tem um espaço", () => {
  const s = initialState();
  assert.equal(s.spaces.length, 1);
  assert.equal(s.spaces[0].name, "Pessoal");
});

test("criar espaço gera id único e valida nome", () => {
  let s = initialState();
  s = createSpace(s, { name: "Trabalho", icon: "briefcase", color: "#71b1ec" });
  s = createSpace(s, { name: "Trabalho", icon: "briefcase", color: null });
  const ids = s.spaces.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => createSpace(s, { name: "   ", icon: "x", color: null }));
});

test("renomear espaço", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  const id = s.spaces[1].id;
  s = renameSpace(s, id, "GOW");
  assert.equal(s.spaces[1].name, "GOW");
});

test("aba sem espaço pertence ao espaço ativo da janela", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  const work = s.spaces[1].id;
  s = setActive(s, 10, work);
  assert.equal(spaceOfTab(s, 99, 10), work);
});

test("só as abas do espaço ativo ficam visíveis", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  const home = s.spaces[0].id;
  const work = s.spaces[1].id;
  s = assignTab(s, 1, home);
  s = assignTab(s, 2, work);
  s = assignTab(s, 3, work);
  s = setActive(s, 10, work);
  assert.deepEqual(visibleTabs(s, tabs, 10).map((t) => t.id), [2, 3]);
  s = setActive(s, 10, home);
  assert.deepEqual(visibleTabs(s, tabs, 10).map((t) => t.id), [1]);
});

test("apagar espaço move as abas pro primeiro espaço", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  const home = s.spaces[0].id;
  const work = s.spaces[1].id;
  s = assignTab(s, 2, work);
  s = setActive(s, 10, work);
  s = deleteSpace(s, work);
  assert.equal(s.spaces.length, 1);
  assert.equal(spaceOfTab(s, 2, 10), home);
  assert.equal(activeSpace(s, 10).id, home);
});

test("não dá pra apagar o último espaço", () => {
  const s = initialState();
  assert.throws(() => deleteSpace(s, s.spaces[0].id));
});

test("esquecer aba fechada", () => {
  let s = assignTab(initialState(), 5, "x");
  s = forgetTab(s, 5);
  assert.equal(s.tabSpace[5], undefined);
});

test("vizinho circula entre os espaços", () => {
  let s = initialState();
  s = createSpace(s, { name: "B", icon: "b", color: null });
  s = createSpace(s, { name: "C", icon: "c", color: null });
  const [a, b, c] = s.spaces.map((x) => x.id);
  assert.equal(neighborSpace(s, a, 1), b);
  assert.equal(neighborSpace(s, c, 1), a);
  assert.equal(neighborSpace(s, a, -1), c);
});

test("lembra a última aba de cada espaço", () => {
  let s = initialState();
  const home = s.spaces[0].id;
  s = rememberTab(s, home, 7);
  assert.equal(s.lastTab[home], 7);
});

test("atualizar ícone e cor sem mudar o id", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  const id = s.spaces[1].id;
  s = updateSpace(s, id, { icon: "code", color: "#7cc2a8", id: "outro" });
  assert.deepEqual(s.spaces[1], { id, name: "Trabalho", icon: "code", color: "#7cc2a8" });
});

test("foto guarda URL e espaço de cada aba", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  s = assignTab(s, 1, "trabalho");
  s = setActive(s, 10, "pessoal");
  const shot = snapshot(s, [{ id: 1, url: "https://gitlab.com/" }, { id: 2, url: "https://github.com/" }], 10);
  assert.deepEqual(shot, [{ url: "https://gitlab.com/", space: "trabalho" }, { url: "https://github.com/", space: "pessoal" }]);
});

test("restaurar casa abas novas pela URL, uma vez cada", () => {
  const shot = [
    { url: "https://a.dev/", space: "trabalho" },
    { url: "https://a.dev/", space: "pessoal" },
    { url: "https://b.dev/", space: "trabalho" },
  ];
  const s = restore(initialState(), [
    { id: 7, url: "https://a.dev/" },
    { id: 8, url: "https://a.dev/" },
    { id: 9, url: "https://c.dev/" },
  ], shot);
  assert.equal(s.tabSpace[7], "trabalho");
  assert.equal(s.tabSpace[8], "pessoal");
  assert.equal(s.tabSpace[9], undefined);
});
