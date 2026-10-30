import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState, createSpace, renameSpace, deleteSpace, assignTab, forgetTab,
  spaceOfTab, visibleTabs, setActive, activeSpace, neighborSpace, rememberTab, updateSpace, snapshot, restore, rekeyTab, setTitle,
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
  assert.deepEqual(s.spaces[1], { id, name: "Trabalho", icon: "code", color: "#7cc2a8", session: id });
});

test("foto guarda URL e espaço de cada aba", () => {
  let s = createSpace(initialState(), { name: "Trabalho", icon: "briefcase", color: null });
  s = assignTab(s, 1, "trabalho");
  s = setActive(s, 10, "pessoal");
  const shot = snapshot(s, [{ id: 1, url: "https://gitlab.com/" }, { id: 2, url: "https://github.com/" }], 10);
  assert.deepEqual(shot, { active: "pessoal", tabs: [{ url: "https://gitlab.com/", space: "trabalho" }, { url: "https://github.com/", space: "pessoal" }] });
});

test("nome próprio da aba: guarda, some com a aba e volta pela foto", async () => {
  const { setTitle } = await import("./spaces-model.js");
  let s = setTitle(initialState(), 3, "  Board  ");
  assert.equal(s.tabTitle[3], "Board");
  assert.equal(snapshot(s, [{ id: 3, url: "https://gitlab.com/" }], 1).tabs[0].title, "Board");
  assert.equal(setTitle(s, 3, " ").tabTitle[3], undefined);
  assert.equal(forgetTab(s, 3).tabTitle[3], undefined);
  const back = restore(initialState(), [{ id: 9, url: "https://gitlab.com/" }], { tabs: [{ url: "https://gitlab.com/", space: "pessoal", title: "Board" }] });
  assert.equal(back.tabTitle[9], "Board");
});

test("restaurar sem URL igual casa as que sobraram pela posição", () => {
  const shot = { tabs: [{ url: "https://a.dev/", space: "pessoal" }, { url: "https://gitlab.com/mr/1", space: "uown" }, { url: "https://b.dev/", space: "uown" }] };
  const s = restore(initialState(), [
    { id: 1, url: "https://a.dev/" },
    { id: 2, url: "https://gitlab.com/mr/2" },
    { id: 3, url: "https://b.dev/" },
  ], shot);
  assert.deepEqual(s.tabSpace, { 1: "pessoal", 2: "uown", 3: "uown" });
});

test("fotos por janela: guarda as 6 mais recentes e escolhe a que mais casa", async () => {
  const { storeSnapshot, pickSnapshot, forgetSnapshot } = await import("./spaces-model.js");
  let stored = storeSnapshot([{ url: "https://velho.dev/", space: "pessoal" }], 1, { active: "uown", tabs: [{ url: "https://a.dev/", space: "uown" }] }, 10);
  stored = storeSnapshot(stored, 2, { active: "pessoal", tabs: [{ url: "https://b.dev/", space: "pessoal" }, { url: "https://c.dev/", space: "pessoal" }] }, 20);
  assert.deepEqual(Object.keys(stored).sort(), ["1", "2"]);
  assert.equal(pickSnapshot(stored, [{ url: "https://a.dev/" }]).key, "1");
  assert.equal(pickSnapshot(stored, [{ url: "https://c.dev/" }, { url: "https://b.dev/" }]).key, "2");
  assert.equal(pickSnapshot(stored, [{ url: "https://z.dev/" }]), null);
  assert.equal(pickSnapshot([{ url: "https://a.dev/", space: "uown" }], [{ url: "https://a.dev/" }]).shot.tabs[0].space, "uown");
  for (let w = 3; w <= 9; w++) stored = storeSnapshot(stored, w, { tabs: [] }, w * 10);
  assert.equal(Object.keys(stored).length, 6);
  assert.deepEqual(Object.keys(stored).sort(), ["4", "5", "6", "7", "8", "9"]);
  assert.deepEqual(Object.keys(forgetSnapshot(stored, "9")).sort(), ["4", "5", "6", "7", "8"]);
});

test("ao reabrir, o espaço é o da aba ativa; sem ela, o último usado", async () => {
  const { reopenedSpace } = await import("./spaces-model.js");
  let s = createSpace(initialState(), { name: "UOWN", icon: "briefcase", color: null });
  s = assignTab(s, 5, "uown");
  assert.equal(reopenedSpace(s, [{ id: 4 }, { id: 5, active: true }], { active: "pessoal" }), "uown");
  assert.equal(reopenedSpace(s, [{ id: 4, active: true }], { active: "uown" }), "uown");
  assert.equal(reopenedSpace(s, [], { active: "sumiu" }), "pessoal");
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
  assert.equal(s.tabSpace[9], "trabalho");
});

test("cada espaço tem sessão própria, o primeiro também; o container antigo vira a sessão", async () => {
  const { withSessions, sessionOf, sessionOfSpace } = await import("./spaces-model.js");
  const old = { ...initialState(), spaces: [{ id: "pessoal", name: "Pessoal", container: "pessoal" }, { id: "job", name: "Job", container: "trabalho" }, { id: "estudos", name: "Estudos" }], active: { 1: "job", 2: "pessoal" } };
  const state = withSessions(old);
  assert.deepEqual(state.spaces.map((s) => s.session), ["pessoal", "trabalho", "estudos"]);
  assert.equal(state.spaces.some((s) => "container" in s), false);
  assert.equal(sessionOf(state, 1), "trabalho");
  assert.equal(sessionOf(state, 2), "pessoal");
  const before = { ...initialState(), spaces: [{ id: "casa", name: "Casa", session: "" }, { id: "job", name: "Job", session: "job" }] };
  assert.deepEqual(withSessions(before).spaces.map((s) => s.session), ["casa", "job"]);
  assert.equal(sessionOfSpace(state, "estudos"), "estudos");
  const next = createSpace(state, { name: "Casa", icon: "house", color: null });
  assert.equal(next.spaces.at(-1).session, "casa");
  assert.equal(withSessions(next).spaces.at(-1).session, "casa");
  assert.equal(initialState().spaces[0].session, "pessoal");
});

test("aba reaberta leva espaço, nome e o posto de última aba pro id novo", () => {
  let s = assignTab(initialState(), 4, "pessoal");
  s = setTitle(rememberTab(s, "pessoal", 4), 4, "Caixa");
  s = rekeyTab(s, 4, 9);
  assert.deepEqual([s.tabSpace, s.tabTitle, s.lastTab], [{ 9: "pessoal" }, { 9: "Caixa" }, { pessoal: 9 }]);
  assert.deepEqual(rekeyTab(s, 1, 2).tabSpace, { 9: "pessoal" });
});
