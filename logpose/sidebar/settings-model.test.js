import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, loadSettings, displayUrl } from "./settings-model.js";

test("sem nada salvo, valem os padrões", () => {
  assert.deepEqual(loadSettings(undefined), DEFAULTS);
});

test("valores salvos válidos sobrescrevem os padrões", () => {
  const s = loadSettings({ followSystemTheme: false, density: "compact" });
  assert.equal(s.followSystemTheme, false);
  assert.equal(s.density, "compact");
  assert.equal(s.showFullUrl, DEFAULTS.showFullUrl);
});

test("quem desligou o tema do Ciel continua com o do sistema desligado", () => {
  assert.equal(loadSettings({ followCielTheme: false }).followSystemTheme, false);
  assert.equal(loadSettings({ followCielTheme: false, followSystemTheme: true }).followSystemTheme, true);
  assert.equal("followCielTheme" in loadSettings({ followCielTheme: false }), false);
});

test("tipos errados e chaves desconhecidas são ignorados", () => {
  const s = loadSettings({ followSystemTheme: "sim", density: "gigante", lixo: 1 });
  assert.deepEqual(s, DEFAULTS);
});

test("URL resumida mostra só o domínio sem www", () => {
  assert.equal(displayUrl("https://www.github.com/AdolfoCarneiro/logpose?tab=1", false), "github.com");
});

test("URL completa quando configurado", () => {
  assert.equal(displayUrl("https://github.com/AdolfoCarneiro/logpose", true), "https://github.com/AdolfoCarneiro/logpose");
});

test("páginas internas aparecem com o esquema", () => {
  assert.equal(displayUrl("chrome://settings/appearance", false), "logpose://settings");
});

test("URL inválida ou vazia não quebra", () => {
  assert.equal(displayUrl("", false), "");
  assert.equal(displayUrl("nao é url", false), "nao é url");
});

test("opacidade do material: padrão 82, aceita 0 a 100 inteiro", () => {
  assert.equal(loadSettings(undefined).materialOpacity, 82);
  assert.equal(loadSettings({ materialOpacity: 40 }).materialOpacity, 40);
  assert.equal(loadSettings({ materialOpacity: 140 }).materialOpacity, 82);
  assert.equal(loadSettings({ materialOpacity: -1 }).materialOpacity, 82);
  assert.equal(loadSettings({ materialOpacity: 50.5 }).materialOpacity, 82);
});

test("dormir e arquivar: padrões e só as escolhas válidas", () => {
  const d = loadSettings(undefined);
  assert.equal(d.sleepAfterMinutes, 30);
  assert.equal(d.archiveAfterHours, 12);
  assert.equal(loadSettings({ sleepAfterMinutes: 0 }).sleepAfterMinutes, 0);
  assert.equal(loadSettings({ sleepAfterMinutes: 45 }).sleepAfterMinutes, 30);
  assert.equal(loadSettings({ archiveAfterHours: 168 }).archiveAfterHours, 168);
  assert.equal(loadSettings({ archiveAfterHours: "12" }).archiveAfterHours, 12);
});

test("nova aba não mostra endereço", () => {
  assert.equal(displayUrl("chrome://newtab/", false), "");
  assert.equal(displayUrl("chrome://newtab/", true), "");
});

test("páginas internas aparecem como logpose://", () => {
  assert.equal(displayUrl("chrome://extensions/?id=x", true), "logpose://extensions/?id=x");
  assert.equal(displayUrl("chrome-extension://hncljkmljckjojdjincglklbdihcaeko/settings.html", false), "logpose://configurações");
  assert.equal(displayUrl("chrome-extension://hncljkmljckjojdjincglklbdihcaeko/newtab.html", false), "");
  assert.equal(displayUrl("chrome-extension://outra/popup.html", false), "chrome-extension://outra");
});

test("Peek nas fixadas: ligado por padrão, só aceita booleano", () => {
  assert.equal(loadSettings(undefined).peekPinnedLinks, true);
  assert.equal(loadSettings({ peekPinnedLinks: false }).peekPinnedLinks, false);
  assert.equal(loadSettings({ peekPinnedLinks: "não" }).peekPinnedLinks, true);
});

test("janela pequena pra links de outros apps: ligada por padrão, só aceita booleano", () => {
  assert.equal(loadSettings(undefined).littleWindowLinks, true);
  assert.equal(loadSettings({ littleWindowLinks: false }).littleWindowLinks, false);
  assert.equal(loadSettings({ littleWindowLinks: 1 }).littleWindowLinks, true);
});
