import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadContainers, createContainer, updateContainer, deleteContainer, membership, containerSnapshot, lostTabs, slug, DEFAULT_CONTAINERS,
} from "./containers-model.js";

test("sem nada salvo vêm Trabalho e Pessoal; lista salva vazia continua vazia", () => {
  assert.deepEqual(loadContainers(undefined).map((c) => c.id), ["trabalho", "pessoal"]);
  assert.deepEqual(loadContainers([]), []);
  assert.deepEqual(loadContainers([{ id: "X y", name: "x", color: "#fff", icon: "user" }, DEFAULT_CONTAINERS[0]]).map((c) => c.id), ["trabalho"]);
});

test("id vem do nome, sem acento, e não repete", () => {
  assert.equal(slug("Banco & Finanças"), "banco-financas");
  let list = createContainer([], { name: " Banco " });
  list = createContainer(list, { name: "banco" });
  assert.deepEqual(list.map((c) => [c.id, c.name]), [["banco", "Banco"], ["banco-2", "banco"]]);
  assert.throws(() => createContainer(list, { name: "  " }));
});

test("editar mantém o id e ignora nome vazio; apagar remove", () => {
  const list = loadContainers(undefined);
  const edited = updateContainer(list, "trabalho", { name: "", color: "#000000", id: "outro" });
  assert.deepEqual(edited[0], { id: "trabalho", name: "Trabalho", color: "#000000", icon: "briefcase" });
  assert.deepEqual(deleteContainer(list, "trabalho").map((c) => c.id), ["pessoal"]);
});

test("snapshot guarda todas as abas na ordem, com o container ou vazio", () => {
  const members = membership([{ tabId: 1, container: "trabalho" }, { tabId: 2, container: "" }]);
  const tabs = [{ id: 2, index: 1, url: "https://github.com/" }, { id: 1, index: 0, url: "https://mail.google.com/" }];
  assert.deepEqual(containerSnapshot(tabs, members), [
    { url: "https://mail.google.com/", container: "trabalho" },
    { url: "https://github.com/", container: "" },
  ]);
});

test("depois de reiniciar, reconhece pela ordem quem estava no container, mesmo com URL repetida", () => {
  const shot = [
    { url: "https://mail.google.com/", container: "" },
    { url: "https://mail.google.com/", container: "trabalho" },
    { url: "https://x.com/", container: "apagado" },
  ];
  const tabs = [
    { id: 9, index: 2, url: "https://x.com/", active: false, pinned: false },
    { id: 7, index: 0, url: "https://mail.google.com/", active: true, pinned: false },
    { id: 8, index: 1, url: "https://mail.google.com/", active: false, pinned: true },
  ];
  assert.deepEqual(lostTabs(shot, tabs, new Map(), DEFAULT_CONTAINERS), [
    { tabId: 8, url: "https://mail.google.com/", index: 1, active: false, pinned: true, container: "trabalho" },
  ]);
  assert.deepEqual(lostTabs(shot, tabs, new Map([[8, "trabalho"]]), DEFAULT_CONTAINERS), []);
});
