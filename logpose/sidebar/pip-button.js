// Botão "Destacar vídeo" por cima do vídeo sob o mouse, como o do Opera: um clique solta o
// vídeo na janelinha flutuante (picture-in-picture) e outro devolve pra aba.
// Roda como content script em toda página (e iframe), fora do DOM do site: o botão mora
// num shadow root próprio preso no <html>, então o player do site não vê o clique.
(() => {
  if (window.__logposePipButton) return;
  window.__logposePipButton = true;

  const MIN_WIDTH = 240;
  const MIN_HEIGHT = 135;
  const HIDE_AFTER_MS = 2500;

  let enabled = true;
  let host = null;
  let button = null;
  let label = null;
  let target = null;
  let pointer = null;
  let frame = 0;
  let idle = 0;

  const ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"/><rect width="10" height="7" x="12" y="13" rx="2"/></svg>';

  function build() {
    host = document.createElement("logpose-pip-button");
    host.style.cssText = "all: initial; position: fixed; inset: 0 auto auto 0; z-index: 2147483647; pointer-events: none;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        button {
          all: unset;
          position: fixed;
          display: none;
          align-items: center;
          gap: 6px;
          padding: 6px 12px 6px 10px;
          border-radius: 999px;
          background: rgba(20, 20, 22, 0.82);
          backdrop-filter: blur(12px);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
          color: #fff;
          font: 500 12.5px/1 system-ui, sans-serif;
          cursor: pointer;
          pointer-events: auto;
          user-select: none;
          white-space: nowrap;
          transform: translateX(-50%);
          opacity: 0;
          transition: opacity 120ms ease, background 120ms ease;
        }
        button.shown { display: inline-flex; opacity: 1; }
        button:hover { background: rgba(40, 40, 44, 0.92); }
        button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      </style>
      <button type="button" part="button">${ICON}<span></span></button>`;
    button = root.querySelector("button");
    label = root.querySelector("span");
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick"]) {
      button.addEventListener(type, (event) => event.stopPropagation());
    }
    button.addEventListener("click", toggle);
    button.addEventListener("pointerenter", () => clearTimeout(idle));
    button.addEventListener("pointerleave", armHide);
  }

  function mount() {
    if (!host) build();
    if (!host.isConnected) document.documentElement.append(host);
  }

  function usable(video) {
    if (video.disablePictureInPicture || video.readyState === 0) return false;
    if (!document.pictureInPictureEnabled) return false;
    const rect = video.getBoundingClientRect();
    return rect.width >= MIN_WIDTH && rect.height >= MIN_HEIGHT;
  }

  function videoAt(x, y) {
    let best = null;
    let bestArea = 0;
    for (const video of document.getElementsByTagName("video")) {
      const r = video.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      if (!usable(video)) continue;
      const area = r.width * r.height;
      if (area > bestArea) {
        best = video;
        bestArea = area;
      }
    }
    return best;
  }

  function hide() {
    clearTimeout(idle);
    target = null;
    button?.classList.remove("shown");
  }

  function armHide() {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!button?.matches(":hover")) hide();
    }, HIDE_AFTER_MS);
  }

  function place() {
    if (!target || !target.isConnected) return hide();
    const r = target.getBoundingClientRect();
    button.style.left = `${Math.round(r.left + r.width / 2)}px`;
    button.style.top = `${Math.round(Math.max(r.top, 0) + 12)}px`;
    label.textContent = document.pictureInPictureElement === target ? "Voltar pra aba" : "Destacar vídeo";
  }

  function update() {
    frame = 0;
    if (!enabled || !pointer || document.fullscreenElement) return hide();
    const video = videoAt(pointer.x, pointer.y);
    if (!video) {
      if (!button?.matches(":hover")) hide();
      return;
    }
    mount();
    target = video;
    place();
    button.classList.add("shown");
    armHide();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    const video = target;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      // Site bloqueou ou o vídeo ainda não carregou: fica como está.
    }
    if (target === video) place();
  }

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    },
    { capture: true, passive: true },
  );
  document.addEventListener("scroll", () => target && place(), { capture: true, passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
    if (!button?.matches(":hover")) hide();
  });
  document.addEventListener("fullscreenchange", hide);
  document.addEventListener("enterpictureinpicture", () => target && place(), true);
  document.addEventListener("leavepictureinpicture", () => target && place(), true);

  const apply = (settings) => {
    enabled = settings?.pipButton !== false;
    if (!enabled) hide();
  };
  chrome.storage.local.get("settings").then(({ settings }) => apply(settings), () => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) apply(changes.settings.newValue);
  });
})();
