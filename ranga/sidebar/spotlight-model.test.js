import { test } from "node:test";
import assert from "node:assert/strict";
import { mayHaveKeyword, suggestions } from "./spotlight-model.js";

const sources = {
  tabs: [{ id: 1, windowId: 9, title: "GitHub - ranga", url: "https://github.com/taigakilla/ranga" }],
  bookmarks: [{ id: "b1", title: "GitHub", url: "https://github.com/" }, { id: "b2", title: "Ranga repo", url: "https://github.com/taigakilla/ranga" }],
  history: [{ title: "Hacker News", url: "https://news.ycombinator.com/", visitCount: 30 }, { title: "GitLab", url: "https://gitlab.com/", visitCount: 2 }],
};

test("texto vira busca na primeira linha", () => {
  const [first] = suggestions("material design", sources);
  assert.deepEqual(first, { kind: "search", title: "Buscar “material design”", text: "material design" });
});

test("domínio vira navegação na primeira linha", () => {
  const [first] = suggestions("gitlab.com", sources);
  assert.equal(first.kind, "url");
  assert.equal(first.url, "https://gitlab.com");
});

test("aba aberta vem antes de favorito e histórico, sem repetir URL", () => {
  const list = suggestions("ranga", sources);
  const kinds = list.slice(1).map((s) => s.kind);
  assert.equal(kinds[0], "tab");
  assert.equal(list.filter((s) => s.url === "https://github.com/taigakilla/ranga").length, 1);
});

test("busca casa título e URL sem diferenciar maiúsculas", () => {
  const list = suggestions("HACKER", sources);
  assert.ok(list.some((s) => s.kind === "history" && s.title === "Hacker News"));
});

test("vazio mostra as abas abertas", () => {
  const list = suggestions("", sources);
  assert.deepEqual(list.map((s) => s.kind), ["tab"]);
});

test("limite de resultados", () => {
  const many = { tabs: [], bookmarks: [], history: Array.from({ length: 30 }, (_, i) => ({ title: `git ${i}`, url: `https://g${i}.dev/`, visitCount: i })) };
  assert.equal(suggestions("git", many, 8).length, 8);
});

test("comando habilitado aparece pelo título ou por palavra-chave, sem acento", () => {
  const list = suggestions("instalar", { ...sources, commands: ["installPwa", "print"] });
  assert.deepEqual(list[0], { kind: "command", command: "installPwa", title: "Instalar como app", icon: "app-window" });
  assert.equal(list[1].kind, "search");
  assert.ok(suggestions("historico", { commands: ["clearBrowsingData"] }).some((s) => s.command === "clearBrowsingData"));
});

test("comando desabilitado não aparece", () => {
  assert.ok(!suggestions("instalar", { commands: ["print"] }).some((s) => s.kind === "command"));
});

test("palavra-chave que não é começo do título fica depois da busca", () => {
  const list = suggestions("pwa", { commands: ["installPwa", "openInApp"] });
  assert.equal(list[0].kind, "search");
  assert.deepEqual(list.slice(1, 3).map((s) => s.command), ["installPwa", "openInApp"]);
});

test("endereço não mostra comandos", () => {
  assert.ok(!suggestions("print.com", { commands: ["print"] }).some((s) => s.kind === "command"));
});

test("palavra do título com 4 letras ou mais também põe o comando na frente", () => {
  const list = suggestions("markdown", { commands: ["copyMarkdown"] });
  assert.equal(list[0].command, "copyMarkdown");
  assert.equal(suggestions("link limpo", { commands: ["copyCleanLink"] })[0].command, "copyCleanLink");
  assert.equal(suggestions("pdf", { commands: ["print"] })[0].kind, "search");
});

test("aba sem título de verdade mostra o endereço do Ranga", async () => {
  const { tabTitle } = await import("./spotlight-model.js");
  assert.equal(tabTitle({ title: "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/onboarding.html", url: "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/onboarding.html" }), "ranga://bem-vindo");
  assert.equal(tabTitle({ title: "", url: "chrome://extensions/" }), "ranga://extensions/");
  assert.equal(tabTitle({ title: "GitHub", url: "https://github.com/" }), "GitHub");
});

test("busca com outro mecanismo mostra o mecanismo e os termos", () => {
  const resolved = { kind: "keyword", url: "https://www.youtube.com/results?search_query=lofi", engine: "YouTube", query: "lofi" };
  const [first] = suggestions("!yt lofi", { resolved });
  assert.deepEqual(first, { kind: "search", title: "Buscar em YouTube: “lofi”", text: "!yt lofi" });
  assert.equal(suggestions("!yt lofi", { resolved: { kind: "search", url: "https://x/" } })[0].title, "Buscar “!yt lofi”");
});

test("só texto com mais de uma palavra pode ter palavra-chave", () => {
  assert.ok(mayHaveKeyword("!yt lofi"));
  assert.ok(mayHaveKeyword("yt lofi"));
  assert.ok(!mayHaveKeyword("!yt"));
  assert.ok(!mayHaveKeyword("  lofi "));
});

test("informações do site, captura, QR code e perfis aparecem quando habilitados", () => {
  const enabled = ["pageInfo", "screenshot", "qrCode", "profiles"];
  assert.equal(suggestions("informacoes", { commands: enabled })[0].command, "pageInfo");
  assert.ok(suggestions("permissoes", { commands: enabled }).some((s) => s.command === "pageInfo"));
  assert.equal(suggestions("capturar", { commands: enabled })[0].command, "screenshot");
  assert.equal(suggestions("qr", { commands: enabled })[0].command, "qrCode");
  assert.equal(suggestions("perfis", { commands: enabled })[0].command, "profiles");
  assert.ok(!suggestions("perfis", { commands: [] }).some((s) => s.kind === "command"));
});
