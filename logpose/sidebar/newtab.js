import { glyph } from "./kurobe/icons.mjs";
import "./kurobe/loading-indicator.mjs";
import { current, label } from "./shortcuts-model.js";
import { available as logposePrivate, call } from "./logpose-private.js";
import { loadSettings } from "./settings-model.js";
import { links } from "./pins-model.js";
import { greeting, fullDate, parseNews, ago, weatherIcon, weatherLabel, shortcuts, parseTickers, tickerLabel, quoteFromChart, sparkPath, money, points, percent } from "./newtab-model.js";

const NEWS_URL = "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419";
const FRESH = 30 * 60 * 1000;
const MARKET_FRESH = 5 * 60 * 1000;
const MARKET_RETRY = 30 * 1000;
const DOLLAR_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const SELIC_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";
const chartUrl = (symbol) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`;
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
const stored = await chrome.storage.local.get(["settings", "shortcuts", "spaces", "pins", "newsCache", "weatherCache", "marketCache"]);
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

// o tempo de agora fica no topo, ao lado da saudação; sem cidade escolhida no denden, nada
async function paintWeather(place) {
  if (!place) return;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const now = (await cached("weatherCache", url, JSON.parse).catch(() => null))?.current;
  if (!now) return;
  $("now-icon").textContent = glyph(weatherIcon(now.weather_code, Boolean(now.is_day)));
  $("now-temp").textContent = `${Math.round(now.temperature_2m)}°`;
  $("now-label").textContent = [weatherLabel(now.weather_code), place.name].filter(Boolean).join(" · ");
  $("now").hidden = false;
}

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
  const key = `v2|${tickers.join(",")}`;
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
      value(ibov) && { name: "Ibovespa", value: `${points(value(ibov).price)} pts`, change: value(ibov).change, spark: value(ibov).spark, query: "ibovespa" },
      value(sp500) && { name: "S&P 500", value: `${points(value(sp500).price)} pts`, change: value(sp500).change, spark: value(sp500).spark, query: "s&p 500" },
    ].filter(Boolean),
    mine: mine.map(value).filter(Boolean).map((q) => ({ name: tickerLabel(q.symbol), title: q.name, fund: q.fund, value: money(q.price, q.currency), change: q.change, spark: q.spark, query: `${tickerLabel(q.symbol)} cotação` })),
  };
  const partial = data.indicators.length < 4 || data.mine.length < tickers.length;
  data.indicators = withPrevious(data.indicators, hit?.data?.indicators, ["Dólar", "Selic", "Ibovespa", "S&P 500"]);
  data.mine = withPrevious(data.mine, hit?.data?.mine, tickers.map(tickerLabel));
  if (!data.indicators.length && !data.mine.length) throw new Error("mercado");
  stored.marketCache = { key, at: Date.now(), partial, data };
  await chrome.storage.local.set({ marketCache: stored.marketCache });
  return data;
}

const SVG = "http://www.w3.org/2000/svg";

function direction(change) {
  return change > 0 ? "up" : change < 0 ? "down" : "flat";
}

function changeChip(change) {
  if (typeof change !== "number") return null;
  return el("span", `chip chip--${direction(change)} k-type-caption`, percent(change));
}

// linha do dia com a área embaixo, na cor da variação; estica na largura que tiver
function sparkline(values, change, className) {
  const w = 100, h = 32;
  const line = sparkPath(values ?? [], w, h);
  if (!line) return null;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", `spark spark--${direction(change)} ${className}`);
  svg.setAttribute("viewBox", `0 -2 ${w} ${h + 4}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const area = document.createElementNS(SVG, "path");
  area.setAttribute("class", "spark__area");
  area.setAttribute("d", `${line}L${w} ${h + 2}L0 ${h + 2}Z`);
  const stroke = document.createElementNS(SVG, "path");
  stroke.setAttribute("class", "spark__line");
  stroke.setAttribute("d", line);
  svg.append(area, stroke);
  return svg;
}

function searchLink(quote, className) {
  const a = el("a", className);
  a.href = `https://www.google.com/search?q=${encodeURIComponent(quote.query)}`;
  return a;
}

function indicatorTile(quote) {
  const a = searchLink(quote, "indicator");
  const head = el("span", "indicator__head");
  head.append(el("span", "indicator__name k-type-caption", quote.name));
  const chip = changeChip(quote.change);
  if (chip) head.append(chip);
  a.append(head, el("span", "indicator__value", quote.value));
  const spark = sparkline(quote.spark, quote.change, "indicator__spark");
  if (spark) a.append(spark);
  return a;
}

function assetRow(quote) {
  const li = el("li");
  const a = searchLink(quote, "asset k-state");
  if (quote.title) a.title = quote.title;
  const id = el("span", "asset__id");
  id.append(el("span", "asset__ticker k-type-label", quote.name));
  if (quote.title) id.append(el("span", "asset__name k-type-caption", quote.title));
  const price = el("span", "asset__price");
  price.append(el("span", "asset__value k-type-label", quote.value));
  const chip = changeChip(quote.change);
  if (chip) price.append(chip);
  a.append(id, sparkline(quote.spark, quote.change, "asset__spark") ?? el("span", "asset__spark"), price);
  li.append(a);
  return li;
}

function paintHoldings(id, quotes) {
  $(id).hidden = quotes.length === 0;
  $(`${id}-list`).replaceChildren(...quotes.map(assetRow));
}

async function paintMarket(force = false) {
  const tickers = parseTickers(settings.marketTickers);
  const state = $("market-state");
  $("market-add").hidden = tickers.length > 0;
  if (!stored.marketCache) state.replaceChildren(document.createElement("k-loading-indicator"));
  try {
    const data = await marketSnapshot(tickers, force);
    state.replaceChildren();
    $("market-list").replaceChildren(...data.indicators.map(indicatorTile));
    paintHoldings("stocks", data.mine.filter((q) => !q.fund));
    paintHoldings("funds", data.mine.filter((q) => q.fund));
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

if (settings.newtabCards) themePort.postMessage({ type: "location" });
if (settings.newtabMarket) {
  $("market").hidden = false;
  paintMarket();
}
if (settings.newtabNews) {
  $("news").hidden = false;
  paintNews();
}
