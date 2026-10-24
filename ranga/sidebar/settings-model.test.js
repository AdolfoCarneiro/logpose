import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, loadSettings, displayUrl } from "./settings-model.js";

test("sem nada salvo, valem os padrões", () => {
  assert.deepEqual(loadSettings(undefined), DEFAULTS);
});

test("valores salvos válidos sobrescrevem os padrões", () => {
  const s = loadSettings({ followCielTheme: false, density: "compact" });
  assert.equal(s.followCielTheme, false);
  assert.equal(s.density, "compact");
  assert.equal(s.showFullUrl, DEFAULTS.showFullUrl);
});

test("tipos errados e chaves desconhecidas são ignorados", () => {
  const s = loadSettings({ followCielTheme: "sim", density: "gigante", lixo: 1 });
  assert.deepEqual(s, DEFAULTS);
});

test("URL resumida mostra só o domínio sem www", () => {
  assert.equal(displayUrl("https://www.github.com/taigakilla/ranga?tab=1", false), "github.com");
});

test("URL completa quando configurado", () => {
  assert.equal(displayUrl("https://github.com/taigakilla/ranga", true), "https://github.com/taigakilla/ranga");
});

test("páginas internas aparecem com o esquema", () => {
  assert.equal(displayUrl("chrome://settings/appearance", false), "chrome://settings");
});

test("URL inválida ou vazia não quebra", () => {
  assert.equal(displayUrl("", false), "");
  assert.equal(displayUrl("nao é url", false), "nao é url");
});
