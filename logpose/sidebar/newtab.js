import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { current, label } from "./shortcuts-model.js";
import { available as logposePrivate, call } from "./logpose-private.js";
import { loadSettings } from "./settings-model.js";
import { links } from "./pins-model.js";
import { greeting, fullDate, parseNews, ago, weatherIcon, weatherLabel, hourly, shortcuts, parseTickers, tickerLabel, quoteFromChart, money, points, percent } from "./newtab-model.js";

const NEWS_URL = "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419";
const FRESH = 30 * 60 * 1000;
const MARKET_FRESH = 5 * 60 * 1000;
const MARKET_RETRY = 30 * 1000;
const DOLLAR_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const SELIC_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";
const chartUrl = (symbol) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
const LOGPOSE = "chrome-extension://hncljkmljckjojdjincglklbdihcaeko/";
const $ = (id) => document.getElementById(id);
const themeStyle = $("logpose-theme");

function paintIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    const target = el.classList.contains("k-icon") ? el : el.querySelector(".k-icon") || el.appendChild(Object.assign(document.createElement("span"), { className: "k-icon" }));
    target.textContent = glyph(el.dataset.icon);
  }
}

function favicon(url, size) {
  return `${LOGPOSE}_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const tab = await chrome.tabs.getCurrent();
const stored = await chrome.storage.local.get(["settings", "shortcuts", "spaces", "pins", "tasks", "newsCache", "weatherCache", "marketCache"]);
const settings = loadSettings(stored.settings);

function paintClock() {
  const now = new Date();
  $("greeting").textContent = greeting(now.getHours());
  $("date").textContent = fullDate(now);
}
paintClock();
setInterval(paintClock, 30 * 1000);

// o spotlight abre com o que já foi digitado na página (spotlightSeed): enquanto ele não
// pega o teclado, as teclas seguem caindo aqui e o texto todo vai junto, com o Enter
let typed = "";
let opening = false;
async function search(text = "", submit = false) {
  if (!logposePrivate || !tab) return;
  typed += text;
  if (!typed.trim() && !submit) return;
  await chrome.storage.session.set({ spotlightSeed: { text: typed, submit } });
  if (opening) return;
  opening = true;
  await call("executeCommand", tab.windowId, "openLocation").catch(() => {});
}
// o spotlight pegou o teclado (ou fechou e devolveu): o próximo texto começa do zero
for (const ev of ["blur", "focus"]) window.addEventListener(ev, () => { typed = ""; opening = false; });
const keys = current(stored.shortcuts).find((s) => s.command === "openLocation")?.keys;
$("keys").replaceChildren(...label(keys).map((k) => el("kbd", "", k)));
// o campo de busca da página fica focado; o que for digitado nele vai pro spotlight
// o Chromium deixa o teclado na barra lateral ou na barra de endereço escondida: a aba ativa
// puxa o foco pra página antes de focar o campo
const searchInput = $("search-input");
if (logposePrivate && tab?.active) await call("executeCommand", tab.windowId, "focusContents").catch(() => {});
searchInput.focus();
searchInput.addEventListener("input", () => {
  const text = searchInput.value;
  searchInput.value = "";
  if (text) search(text);
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search("", true);
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.key.length !== 1 || e.key === " ") return;
  if (e.target.closest?.("input, textarea, [contenteditable]")) return;
  e.preventDefault();
  search(e.key);
});

async function paintShortcuts() {
  const space = tab ? stored.spaces?.active?.[tab.windowId] : null;
  const pinned = space ? links(stored.pins?.[space] ?? []).map((n) => ({ url: n.url, title: n.title })) : [];
  const top = await chrome.topSites?.get().catch(() => []) ?? [];
  $("shortcuts").replaceChildren(...shortcuts(pinned, top).map((site) => {
    const a = el("a", `tile${site.pinned ? " tile--pinned" : ""}`);
    a.href = site.url;
    a.title = site.title;
    const icon = el("span", "tile__icon");
    icon.append(Object.assign(document.createElement("img"), { src: favicon(site.url, 64), alt: "" }));
    a.append(icon, el("span", "tile__label k-type-caption", site.title));
    return a;
  }));
}
paintShortcuts();

async function cached(key, url, parse) {
  const hit = stored[key];
  if (hit?.url === url && Date.now() - hit.at < FRESH) return hit.data;
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const data = parse(await response.text());
  stored[key] = { url, at: Date.now(), data };
  await chrome.storage.local.set({ [key]: stored[key] });
  return data;
}

async function paintWeather(place) {
  if (!place) {
    $("weather-empty").hidden = false;
    return;
  }
  $("weather-title").textContent = place.name ? `Tempo em ${place.name}` : "Tempo";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day&forecast_days=2&timezone=auto`;
  const forecast = await cached("weatherCache", url, JSON.parse).catch(() => null);
  if (!forecast) {
    $("weather-empty").textContent = "Não deu pra buscar a previsão agora.";
    $("weather-empty").hidden = false;
    return;
  }
  const now = forecast.current;
  if (now) {
    $("now-icon").textContent = glyph(weatherIcon(now.weather_code, Boolean(now.is_day)));
    $("now-temp").textContent = `${Math.round(now.temperature_2m)}°`;
    $("now-label").textContent = [weatherLabel(now.weather_code), place.name].filter(Boolean).join(" · ");
    $("now").hidden = false;
  }
  $("hours").replaceChildren(...hourly(forecast, Date.now()).map((h, i) => {
    const li = el("li", "hour");
    li.append(el("span", "hour__time k-type-caption", i === 0 ? "Agora" : `${h.hour}h`), Object.assign(el("span", "k-icon"), { textContent: glyph(weatherIcon(h.code, h.day)) }), el("span", "hour__temp k-type-label", `${h.temp}°`));
    return li;
  }));
}

let tasks = Array.isArray(stored.tasks) ? stored.tasks : [];

async function saveTasks(next) {
  tasks = next;
  await chrome.storage.local.set({ tasks });
  paintTasks();
}

function paintTasks() {
  $("tasks-empty").hidden = tasks.length > 0;
  $("tasks-clear").hidden = !tasks.some((t) => t.done);
  $("task-list").replaceChildren(...tasks.map((task) => {
    const li = el("li", `task${task.done ? " task--done" : ""}`);
    const check = el("button", "task__check k-state");
    check.type = "button";
    const box = el("span", "task__box");
    box.append(Object.assign(el("span", "k-icon"), { textContent: glyph("check") }));
    check.append(box, el("span", "task__text k-type-body", task.text));
    check.onclick = () => saveTasks(tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    const remove = el("button", "task__remove k-icon-button k-icon-button--small k-state");
    remove.type = "button";
    remove.title = "Apagar";
    remove.append(Object.assign(el("span", "k-icon"), { textContent: glyph("x") }));
    remove.onclick = () => saveTasks(tasks.filter((t) => t.id !== task.id));
    li.append(check, remove);
    return li;
  }));
}

$("task-form").onsubmit = (e) => {
  e.preventDefault();
  const text = $("task-input").value.trim();
  if (!text) return;
  $("task-input").value = "";
  saveTasks([...tasks, { id: `t${Date.now().toString(36)}`, text, done: false }]);
};
$("tasks-clear").onclick = () => saveTasks(tasks.filter((t) => !t.done));

async function paintNews(force = false) {
  const state = $("news-state");
  if (force) delete stored.newsCache;
  if (!stored.newsCache) state.replaceChildren(document.createElement("k-loading-indicator"));
  try {
    const news = await cached("newsCache", NEWS_URL, parseNews);
    state.replaceChildren();
    const now = Date.now();
    $("news-list").replaceChildren(...news.slice(0, 18).map((article) => {
      const a = el("a", "article");
      a.href = article.link;
      const source = el("div", "article__source k-type-caption");
      if (article.sourceUrl) source.append(Object.assign(document.createElement("img"), { src: favicon(article.sourceUrl, 32), alt: "" }));
      source.append(el("span", "", [article.source, ago(article.published, now)].filter(Boolean).join(" · ")));
      a.append(source, el("h3", "article__title", article.title));
      return a;
    }));
  } catch {
    const retry = el("button", "k-button k-button--text k-type-button", "Tentar de novo");
    retry.onclick = () => paintNews(true);
    state.replaceChildren(el("p", "hint k-type-label", "Não deu pra carregar as notícias."), retry);
  }
}
$("news-refresh").onclick = (e) => {
  e.currentTarget.querySelector(".k-icon").animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 600, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  paintNews(true);
};

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

async function yahoo(symbol) {
  return quoteFromChart(await json(chartUrl(symbol)));
}

// mantém o último valor bom do que falhou agora (a API do Banco Central às vezes não responde)
function withPrevious(fresh, previous, expected) {
  const byName = new Map((previous ?? []).map((q) => [q.name, q]));
  const got = new Set(fresh.map((q) => q.name));
  return expected.map((name) => (got.has(name) ? fresh.find((q) => q.name === name) : byName.get(name))).filter(Boolean);
}

// dólar, Selic, Ibovespa, S&P 500 e as ações escolhidas; o que falhar fica com o último valor bom
// e o mercado tenta de novo em 30 s em vez de 5 min
async function marketSnapshot(tickers, force) {
  const key = tickers.join(",");
  const hit = stored.marketCache;
  if (!force && hit?.key === key && Date.now() - hit.at < (hit.partial ? MARKET_RETRY : MARKET_FRESH)) return hit.data;
  const [dollar, selic, ibov, sp500, ...mine] = await Promise.allSettled([
    json(DOLLAR_URL), json(SELIC_URL), yahoo("^BVSP"), yahoo("^GSPC"), ...tickers.map(yahoo),
  ]);
  const value = (r) => (r.status === "fulfilled" ? r.value : null);
  const usd = value(dollar)?.USDBRL;
  const rate = value(selic)?.[0]?.valor;
  const data = {
    indicators: [
      usd && { name: "Dólar", value: money(Number(usd.bid)), change: Number(usd.pctChange), query: "dólar hoje" },
      rate && { name: "Selic", value: `${String(rate).replace(".", ",")}% a.a.`, query: "taxa selic" },
      value(ibov) && { name: "Ibovespa", value: `${points(value(ibov).price)} pts`, change: value(ibov).change, query: "ibovespa" },
      value(sp500) && { name: "S&P 500", value: `${points(value(sp500).price)} pts`, change: value(sp500).change, query: "s&p 500" },
    ].filter(Boolean),
    mine: mine.map(value).filter(Boolean).map((q) => ({ name: tickerLabel(q.symbol), value: money(q.price, q.currency), change: q.change, query: `${tickerLabel(q.symbol)} cotação` })),
  };
  const partial = data.indicators.length < 4 || data.mine.length < tickers.length;
  data.indicators = withPrevious(data.indicators, hit?.data?.indicators, ["Dólar", "Selic", "Ibovespa", "S&P 500"]);
  data.mine = withPrevious(data.mine, hit?.data?.mine, tickers.map(tickerLabel));
  if (!data.indicators.length && !data.mine.length) throw new Error("mercado");
  stored.marketCache = { key, at: Date.now(), partial, data };
  await chrome.storage.local.set({ marketCache: stored.marketCache });
  return data;
}

function quoteTile(quote) {
  const a = el("a", "quote");
  a.href = `https://www.google.com/search?q=${encodeURIComponent(quote.query)}`;
  a.append(el("span", "quote__name k-type-caption", quote.name), el("span", "quote__value", quote.value));
  if (typeof quote.change === "number") {
    const dir = quote.change > 0 ? " quote__change--up" : quote.change < 0 ? " quote__change--down" : "";
    a.append(el("span", `quote__change k-type-caption${dir}`, `${percent(quote.change)} hoje`));
  }
  return a;
}

async function paintMarket(force = false) {
  const tickers = parseTickers(settings.marketTickers);
  const state = $("market-state");
  $("market-add").hidden = tickers.length > 0;
  if (!stored.marketCache) state.replaceChildren(document.createElement("k-loading-indicator"));
  try {
    const data = await marketSnapshot(tickers, force);
    state.replaceChildren();
    $("market-list").replaceChildren(...data.indicators.map(quoteTile));
    $("market-mine").replaceChildren(...data.mine.map(quoteTile));
  } catch {
    const retry = el("button", "k-button k-button--text k-type-button", "Tentar de novo");
    retry.onclick = () => paintMarket(true);
    state.replaceChildren(el("p", "hint k-type-label", "Não deu pra carregar o mercado."), retry);
  }
}
$("market-refresh").onclick = (e) => {
  e.currentTarget.querySelector(".k-icon").animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 600, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  paintMarket(true);
};
$("market-add").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });

paintIcons();

const themePort = chrome.runtime.connectNative("logpose.theme");
themePort.onMessage.addListener((msg) => {
  if (msg.type === "theme") themeStyle.textContent = msg.css;
  if (msg.type === "location" && settings.newtabCards) paintWeather(msg.location);
});

if (settings.newtabCards) {
  $("weather").hidden = false;
  $("tasks").hidden = false;
  paintTasks();
  themePort.postMessage({ type: "location" });
}
if (settings.newtabMarket) {
  $("market").hidden = false;
  paintMarket();
}
if (settings.newtabNews) {
  $("news").hidden = false;
  paintNews();
}
