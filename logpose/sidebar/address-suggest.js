import { suggestions } from "./spotlight-model.js";
import { displayUrl } from "./settings-model.js";
import { toNavigation } from "./tabs-model.js";
import { glyph } from "./kurobe/icons.mjs";
import { available as logposePrivate, call } from "./logpose-private.js";

// sugestões embaixo do campo de endereço enquanto digita, igual à barra de endereço
// dos navegadores comuns: o site que você já visita completado, busca, sugestões do
// buscador e abas, favoritos e histórico (a mesma lista do spotlight, sem comandos)
export function setupAddressSuggest({ input, list, windowId, incognito, run }) {
  let items = [];
  let selected = -1;
  let shownFor = null;
  let timer;
  let typed = false;
  const suggestCache = new Map();

  function faviconFor(url) {
    const src = new URL(chrome.runtime.getURL("/_favicon/"));
    src.searchParams.set("pageUrl", url);
    src.searchParams.set("size", "32");
    return src.toString();
  }

  const open = () => !list.hidden;
  const selectable = (i) => items[i] && items[i].kind !== "header";

  function hide() {
    clearTimeout(timer);
    list.hidden = true;
    list.replaceChildren();
    items = [];
    selected = -1;
    shownFor = null;
    typed = false;
  }

  function mark() {
    for (const [i, li] of [...list.children].entries()) li.classList.toggle("suggest--selected", i === selected);
    list.children[selected]?.scrollIntoView({ block: "nearest" });
  }

  function step(direction) {
    for (let i = selected + direction; i >= 0 && i < items.length; i += direction) {
      if (selectable(i)) { selected = i; mark(); return; }
    }
  }

  function row(item, index) {
    const li = document.createElement("li");
    if (item.kind === "header") {
      li.className = "suggest-section k-type-caption";
      li.textContent = item.title;
      return li;
    }
    li.className = "suggest k-state k-type-label";
    const icon = document.createElement("span");
    icon.className = "suggest-icon";
    if (item.url && item.kind !== "site") {
      const img = Object.assign(document.createElement("img"), { alt: "", src: faviconFor(item.url) });
      icon.append(img);
    } else {
      icon.innerHTML = `<span class="k-icon">${glyph(item.kind === "url" ? "globe" : "search")}</span>`;
    }
    const text = document.createElement("span");
    text.className = "suggest-text";
    const title = Object.assign(document.createElement("span"), { className: "suggest-title", textContent: item.title });
    text.append(title);
    if (item.url && item.kind !== "url" && item.kind !== "site") {
      const url = Object.assign(document.createElement("span"), { className: "suggest-url k-type-caption" });
      url.textContent = displayUrl(item.url, true).replace(/^https?:\/\/(www\.)?/, "");
      text.append(url);
    }
    li.append(icon, text);
    if (item.kind === "tab") li.append(Object.assign(document.createElement("span"), { className: "suggest-kind k-type-caption", textContent: "Aba" }));
    li.onmousemove = () => { if (selected !== index) { selected = index; mark(); } };
    // mousedown sem tirar o foco do campo (o blur fecharia a lista antes do clique)
    li.onmousedown = (e) => e.preventDefault();
    li.onclick = () => choose(item);
    return li;
  }

  function paint(text, next, keep) {
    const key = keep && items[selected] ? JSON.stringify(items[selected]) : null;
    items = next;
    shownFor = text;
    selected = key ? items.findIndex((i) => JSON.stringify(i) === key) : -1;
    if (selected < 0) { selected = 0; if (!selectable(0)) step(1); }
    list.replaceChildren(...items.map(row));
    list.hidden = !items.length;
    mark();
  }

  async function sources(text) {
    const private_ = incognito();
    const [tabs, history, bookmarks] = await Promise.all([
      chrome.tabs.query(private_ ? { windowId: windowId() } : {}),
      private_ ? [] : chrome.history.search({ text, maxResults: 25, startTime: 0 }),
      private_ ? [] : chrome.bookmarks.search(text),
    ]);
    const [active] = await chrome.tabs.query({ active: true, windowId: windowId() });
    return { tabs: tabs.filter((t) => t.id !== active?.id && !/^chrome:\/\/newtab\/?$/.test(t.url || "")), history, bookmarks };
  }

  function engineSuggestions(text) {
    const clean = text.trim();
    if (!logposePrivate || incognito() || !clean || toNavigation(clean).kind === "url") return null;
    if (!suggestCache.has(clean)) suggestCache.set(clean, call("getSearchSuggestions", windowId(), clean).catch(() => []));
    return suggestCache.get(clean);
  }

  async function refresh() {
    const text = input.value;
    if (!text.trim()) return hide();
    const base = await sources(text);
    if (input.value !== text || document.activeElement !== input) return;
    paint(text, suggestions(text, base));
    const pending = engineSuggestions(text);
    const suggested = pending ? await pending : [];
    if (suggested.length && input.value === text && document.activeElement === input) paint(text, suggestions(text, { ...base, suggested }), true);
  }

  async function choose(item) {
    hide();
    input.blur();
    await run(item);
  }

  input.addEventListener("input", () => {
    typed = true;
    clearTimeout(timer);
    timer = setTimeout(refresh, 50);
  });
  input.addEventListener("blur", hide);
  window.addEventListener("blur", hide);

  // devolve true quando a tecla foi tratada aqui
  return {
    async key(e) {
      if (e.key === "Escape" && open()) { hide(); return true; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!open()) return false;
        e.preventDefault();
        step(e.key === "ArrowDown" ? 1 : -1);
        return true;
      }
      // Enter sem ter digitado nada (só o endereço da aba): segue o caminho normal
      if (e.key !== "Enter" || !typed) return false;
      // Enter antes de a lista alcançar o texto: espera a lista nova
      if (input.value.trim() && shownFor !== input.value) {
        clearTimeout(timer);
        await refresh();
      }
      const item = selectable(selected) ? items[selected] : null;
      if (!item) return false;
      e.preventDefault();
      await choose(item);
      return true;
    },
    hide,
  };
}
