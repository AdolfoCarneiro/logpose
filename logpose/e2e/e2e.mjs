import { execFileSync } from "node:child_process";

// Roda pelo logpose/bin/logpose-e2e: o navegador num X virtual ($DISPLAY), teclas e mouse
// de verdade pelo xdotool (o CDP não passa pelos atalhos do navegador), o resto pelo CDP.
const PORT = Number(process.env.LOGPOSE_DEBUG_PORT ?? 9334);
const EXT = "hncljkmljckjojdjincglklbdihcaeko";
const HOME = "https://example.com/?e2e";
const OTHER = "https://example.org/?e2e";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function xdotool(...args) {
  execFileSync("xdotool", args);
}

function key(name, ...mods) {
  xdotool("key", [...mods, name].join("+"));
}

async function connect(match, what) {
  for (let i = 0; i < 20; i++) {
    const found = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(match);
    if (found) {
      const ws = new WebSocket(found.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      let next = 0;
      const pending = new Map();
      ws.onmessage = (e) => {
        const message = JSON.parse(e.data);
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      };
      const send = (method, params = {}) => new Promise((resolve) => {
        const id = ++next;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
      return {
        send,
        close: () => ws.close(),
        async eval(expression, userGesture = false) {
          const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture });
          if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? "erro no eval");
          return reply.result?.result?.value;
        },
      };
    }
    await sleep(250);
  }
  throw new Error(`alvo não encontrado: ${what}`);
}

async function run(match, what, expression, userGesture) {
  const target = await connect(match, what);
  try {
    return await target.eval(expression, userGesture);
  } finally {
    target.close();
  }
}

const sidebar = (expression) => run((t) => t.url.startsWith(`chrome-extension://${EXT}/sidebar.html`), "barra lateral", expression);
const worker = (expression) => run((t) => t.type === "service_worker" && t.url.includes(`${EXT}/background.js`), "service worker", expression);
const page = (prefix, expression, gesture = false) => run((t) => t.type === "page" && t.url.startsWith(prefix), prefix, expression, gesture);
const width = () => page(HOME, "innerWidth");
const activeTab = () => worker("chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([t]) => t)");

async function until(read, check, timeout = 3000) {
  const start = Date.now();
  let value = await read();
  while (!check(value) && Date.now() - start < timeout) {
    await sleep(150);
    value = await read();
  }
  return value;
}

const near = (w) => Math.abs(w - docked) <= 2;

function expect(ok, message) {
  if (!ok) throw new Error(message);
}

let docked = 0;

async function settled() {
  let last = await width();
  for (let same = 0; same < 3; ) {
    await sleep(150);
    const now = await width();
    same = now === last ? same + 1 : 0;
    last = now;
  }
  return last;
}

async function dock() {
  if (await sidebar("document.body.classList.contains('collapsed')")) key("s", "ctrl", "shift");
  await until(width, (w) => w < 1700);
  docked = await settled();
}

async function prepare() {
  xdotool("mousemove", "1400", "500");
  await worker(`(async () => {
    for (const t of await chrome.tabs.query({})) if (t.splitViewId > 0) await chrome.tabs.unsplit(t.splitViewId).catch(() => {});
    const tabs = await chrome.tabs.query({ windowType: "normal" });
    const home = tabs.find((t) => t.url.startsWith("${HOME}"));
    await chrome.tabs.update(home.id, { url: "${HOME}" });
    await chrome.tabs.remove(tabs.filter((t) => t.id !== home.id).map((t) => t.id));
    await chrome.tabs.create({ windowId: home.windowId, url: "${OTHER}", active: false });
    await chrome.tabs.update(home.id, { active: true });
    return 1;
  })()`);
  await sleep(1500);
  await dock();
}

async function dragTab(tabId, dx, dy) {
  const bar = await connect((t) => t.url.startsWith(`chrome-extension://${EXT}/sidebar.html`), "barra lateral");
  try {
    const box = await bar.eval(`(() => {
      const li = document.querySelector('#tabs li[data-id="${tabId}"]');
      li.scrollIntoView({ block: "center" });
      const r = li.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: innerWidth };
    })()`);
    const mouse = (type, x, y, buttons = 1) => bar.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });
    await mouse("mousePressed", box.x, box.y);
    const to = { x: box.w + dx, y: dy };
    for (let i = 1; i <= 12; i++) {
      await mouse("mouseMoved", box.x + ((to.x - box.x) * i) / 12, box.y + ((to.y - box.y) * i) / 12);
      await sleep(40);
    }
    await sleep(700);
    await mouse("mouseReleased", to.x, to.y, 0);
  } finally {
    bar.close();
  }
}

const TESTS = [
  ["a barra tem a API do Log Pose", async () => {
    expect(await sidebar("typeof chrome.logposePrivate") === "object", "chrome.logposePrivate ausente na barra");
  }],
  ["Alt+← volta e mostra a seta na borda", async () => {
    await page(HOME, `location.assign("${HOME}&antes"); 1`);
    await sleep(1500);
    const link = await page(`${HOME}&antes`, `(() => { const a = document.querySelector("a"); a.href = "${HOME}&depois"; a.removeAttribute("target"); const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    const target = await connect((t) => t.type === "page" && t.url.startsWith(`${HOME}&antes`), "página");
    for (const type of ["mousePressed", "mouseReleased"]) await target.send("Input.dispatchMouseEvent", { type, x: link.x, y: link.y, button: "left", clickCount: 1 });
    target.close();
    await sleep(1500);
    key("Left", "alt");
    const shown = await until(() => run((t) => t.url.includes(`${EXT}/nav.html`), "seta", "document.body.classList.contains('showing') && document.body.dataset.side"), (v) => v === "back", 1500);
    expect(shown === "back", `seta não apareceu (${shown})`);
    const url = await until(async () => (await activeTab()).url, (u) => u.endsWith("&antes"));
    expect(url.endsWith("&antes"), `não voltou: ${url}`);
    await worker(`chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([t]) => chrome.tabs.update(t.id, { url: "${HOME}" })).then(() => 1)`);
    await sleep(1500);
  }],
  ["o atalho recolhe e fixa a barra", async () => {
    key("s", "ctrl", "shift");
    const collapsed = await until(width, (w) => w > docked + 200);
    expect(collapsed > docked + 200, `não recolheu (${docked} → ${collapsed})`);
    key("s", "ctrl", "shift");
    const back = await until(width, near);
    expect(near(back), `não voltou (${back}, esperado ${docked})`);
  }],
  ["recolhida, a barra continua acordada e o atalho dela funciona", async () => {
    key("s", "ctrl", "shift");
    await until(width, (w) => w > docked + 200);
    await sleep(800);
    expect(await sidebar("document.visibilityState") === "visible", "a página da barra ficou oculta");
    key("d", "ctrl", "shift");
    const split = await until(async () => (await activeTab()).splitViewId, (s) => s > 0, 1500);
    expect(split > 0, "Ctrl+Shift+D com a barra recolhida não dividiu");
    key("d", "ctrl", "shift");
    await until(async () => (await activeTab()).splitViewId, (s) => !(s > 0), 1500);
    await dock();
  }],
  ["tela cheia do vídeo recolhe a barra e o Esc traz de volta", async () => {
    await page(HOME, "document.documentElement.requestFullscreen().then(() => 1)", true);
    const full = await until(width, (w) => w > docked + 200);
    expect(full > docked + 200, "não entrou em tela cheia");
    key("Escape");
    const back = await until(width, near);
    expect(near(back), `a barra não voltou depois do Esc (${back})`);
  }],
  ["um toque no Esc sai do F11, a não ser que a página use o Esc", async () => {
    key("F11");
    expect(await until(width, (w) => w > docked + 200) > docked + 200, "F11 não entrou em tela cheia");
    key("Escape");
    expect(near(await until(width, near)), "um toque no Esc não saiu do F11");
    await page(HOME, `window.e2eEsc = (e) => { if (e.key === "Escape") e.preventDefault(); }; addEventListener("keydown", e2eEsc); 1`);
    key("F11");
    await until(width, (w) => w > docked + 200);
    key("Escape");
    await sleep(800);
    expect(await width() > docked + 200, "o Esc que a página usou tirou da tela cheia");
    xdotool("keydown", "Escape");
    await sleep(2500);
    xdotool("keyup", "Escape");
    expect(near(await until(width, near)), "segurar o Esc não saiu da tela cheia");
    await page(HOME, `removeEventListener("keydown", e2eEsc); 1`);
  }],
  ["arrastar uma aba pra borda da página divide com a aba da tela", async () => {
    const [home, other] = await worker(`chrome.tabs.query({}).then((tabs) => ["${HOME}", "${OTHER}"].map((url) => tabs.find((t) => t.url === url).id))`);
    await worker(`chrome.tabs.update(${home}, { active: true }).then(() => 1)`);
    await sleep(600);
    await dragTab(other, 40, 500);
    const pair = await until(() => worker(`Promise.all([${home}, ${other}].map((id) => chrome.tabs.get(id).then((t) => t.splitViewId)))`), ([a, b]) => a > 0 && a === b);
    expect(pair[0] > 0 && pair[0] === pair[1], "as duas abas não ficaram na mesma divisão");
    await worker(`chrome.tabs.unsplit(${pair[0]}).then(() => 1)`);
  }],
  ["o buscador escolhido substitui o padrão só na busca", async () => {
    const result = await sidebar(`(async () => {
      const call = (name, ...args) => new Promise((resolve) => chrome.logposePrivate[name](...args, resolve));
      const engines = await call("getSearchEngines");
      const other = engines.find((e) => !e.isDefault);
      const { id: windowId } = await chrome.windows.getCurrent();
      return {
        name: other.name,
        search: await call("resolveInput", windowId, "lobo guara", other.id),
        address: await call("resolveInput", windowId, "example.net", other.id),
      };
    })()`);
    expect(result.search.kind === "keyword" && result.search.engine === result.name, `a busca não foi pro ${result.name}: ${JSON.stringify(result.search)}`);
    expect(result.address.kind === "url", "um endereço virou busca");
  }],
  ["a fixada que dorme continua fixada e no espaço dela", async () => {
    const result = await worker(`(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const tab = (await chrome.tabs.query({})).find((t) => t.url === "${OTHER}");
      const { spaces } = await chrome.storage.local.get("spaces");
      const space = spaces.tabSpace[tab.id];
      const { pins = {} } = await chrome.storage.local.get("pins");
      await chrome.storage.local.set({ pins: { ...pins, [space]: [...(pins[space] ?? []), { id: "pin-e2e", kind: "link", url: tab.url, title: "e2e" }] } });
      const { pinLive = {} } = await chrome.storage.session.get("pinLive");
      await chrome.storage.session.set({ pinLive: { ...pinLive, [tab.id]: "pin-e2e" } });
      await wait(500);
      const slept = await chrome.tabs.discard(tab.id);
      await chrome.tabs.create({ windowId: tab.windowId, url: "about:blank", active: false });
      await wait(1500);
      const live = (await chrome.storage.session.get("pinLive")).pinLive;
      const after = (await chrome.storage.local.get("spaces")).spaces;
      const { pins: now } = await chrome.storage.local.get("pins");
      await chrome.storage.local.set({ pins: { ...now, [space]: now[space].filter((n) => n.id !== "pin-e2e") } });
      return { changed: slept.id !== tab.id, pin: live[slept.id], space: after.tabSpace[slept.id] === space };
    })()`);
    expect(result.changed, "dormir não trocou o id da aba (o teste não testou nada)");
    expect(result.pin === "pin-e2e", "a fixada perdeu a aba ao dormir");
    expect(result.space, "a aba saiu do espaço ao dormir");
  }],
  ["fechar a última aba de um espaço abre uma nova nele, sem trocar de espaço", async () => {
    const spaceOf = () => worker(`(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const { spaces } = await chrome.storage.local.get("spaces");
      return { tab: tab.id, url: tab.url || tab.pendingUrl, active: spaces.active[tab.windowId], space: spaces.tabSpace[tab.id] };
    })()`);
    await worker(`(async () => {
      const { spaces } = await chrome.storage.local.get("spaces");
      await chrome.storage.local.set({ spaces: { ...spaces, spaces: [...spaces.spaces, { id: "e2e-fecha", name: "E2E fecha", icon: "circle", color: null, session: "e2e-fecha" }] } });
      return 1;
    })()`);
    await sleep(500);
    await sidebar(`document.querySelector('.space[title="E2E fecha"]').click(), 1`);
    const opened = await until(spaceOf, (s) => s.active === "e2e-fecha" && s.space === "e2e-fecha");
    expect(opened.space === "e2e-fecha", `entrar no espaço vazio não abriu aba nele (${JSON.stringify(opened)})`);
    await worker(`chrome.tabs.remove(${opened.tab}).then(() => 1)`);
    await sleep(1500);
    const after = await spaceOf();
    await sidebar(`document.querySelector('.space[title="Pessoal"]').click(), 1`);
    await sleep(800);
    await worker(`(async () => {
      const { spaces } = await chrome.storage.local.get("spaces");
      const gone = Object.entries(spaces.tabSpace).filter(([, s]) => s === "e2e-fecha").map(([id]) => Number(id));
      await chrome.tabs.remove(gone).catch(() => {});
      const now = (await chrome.storage.local.get("spaces")).spaces;
      await chrome.storage.local.set({ spaces: { ...now, spaces: now.spaces.filter((s) => s.id !== "e2e-fecha") } });
      return 1;
    })()`);
    expect(after.active === "e2e-fecha", `trocou de espaço ao fechar a última aba (foi pra ${after.active})`);
    expect(after.tab !== opened.tab && after.space === "e2e-fecha", `não abriu aba nova no espaço (${JSON.stringify(after)})`);
  }],
];

await prepare();
let failed = 0;
for (const [name, test] of TESTS) {
  try {
    await test();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`FALHOU ${name}: ${error.message}`);
    await dock().catch(() => {});
  }
}
console.log(failed ? `${failed} de ${TESTS.length} falharam` : `${TESTS.length} testes passaram`);
process.exit(failed ? 1 : 0);
