import { test } from "node:test";
import assert from "node:assert/strict";
import { favoritesRoot, entries } from "./favorites-model.js";

const tree = [{
  id: "0",
  children: [
    { id: "1", title: "Barra de favoritos", children: [
      { id: "10", title: "GitHub", url: "https://github.com/" },
      { id: "11", title: "Trabalho", children: [
        { id: "110", title: "Jira", url: "https://jira.example/" },
      ] },
      { id: "12", title: "", url: "https://m3.material.io/" },
    ] },
    { id: "2", title: "Outros favoritos", children: [] },
  ],
}];

test("a raiz dos favoritos é a barra de favoritos", () => {
  assert.equal(favoritesRoot(tree).id, "1");
});

test("árvore vazia não quebra", () => {
  assert.equal(favoritesRoot([]), null);
});

test("entradas de uma pasta: pastas primeiro, depois links, com título de reserva", () => {
  const list = entries(favoritesRoot(tree));
  assert.deepEqual(list.map((e) => [e.id, e.kind, e.title]), [
    ["11", "folder", "Trabalho"],
    ["10", "link", "GitHub"],
    ["12", "link", "m3.material.io"],
  ]);
  assert.equal(list[0].count, 1);
});
