import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, fileName, progress, status, active, overall } from "./downloads-model.js";

test("tamanhos em unidades decimais, com vírgula", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(204800), "205 KB");
  assert.equal(formatBytes(1_500_000), "1,5 MB");
  assert.equal(formatBytes(-1), "");
});

test("nome do arquivo vem do caminho", () => {
  assert.equal(fileName({ filename: "/home/u/Downloads/foto.png" }), "foto.png");
  assert.equal(fileName({ filename: "", url: "https://x.dev/a/relatorio.pdf" }), "relatorio.pdf");
});

test("progresso e situação", () => {
  assert.equal(progress({ state: "in_progress", bytesReceived: 50, totalBytes: 200 }), 0.25);
  assert.equal(progress({ state: "in_progress", bytesReceived: 50, totalBytes: 0 }), null);
  assert.equal(status({ state: "in_progress", bytesReceived: 1_000_000, totalBytes: 4_000_000 }), "1 MB de 4 MB");
  assert.equal(status({ state: "in_progress", paused: true, bytesReceived: 2000 }), "Pausado · 2 KB");
  assert.equal(status({ state: "interrupted", error: "USER_CANCELED" }), "Cancelado");
  assert.equal(status({ state: "complete", totalBytes: 204800 }), "205 KB");
});

test("progresso geral só dos que estão baixando", () => {
  const items = [
    { state: "in_progress", bytesReceived: 50, totalBytes: 100 },
    { state: "in_progress", bytesReceived: 50, totalBytes: 300 },
    { state: "complete", bytesReceived: 10, totalBytes: 10 },
  ];
  assert.equal(active(items).length, 2);
  assert.equal(overall(items), 0.25);
  assert.equal(overall([{ state: "complete", totalBytes: 1, bytesReceived: 1 }]), null);
});
