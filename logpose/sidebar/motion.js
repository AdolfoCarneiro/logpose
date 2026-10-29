const springs = new Map();

export function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function spring(name) {
  if (!springs.has(name)) {
    const style = getComputedStyle(document.documentElement);
    springs.set(name, {
      easing: style.getPropertyValue(`--k-motion-spring-${name}`).trim() || "ease",
      duration: parseFloat(style.getPropertyValue(`--k-motion-spring-${name}-duration`)) || 300,
    });
  }
  return springs.get(name);
}

export function animate(el, keyframes, name) {
  if (reducedMotion()) return null;
  const { easing, duration } = spring(name);
  return el.animate(keyframes, { duration, easing });
}

export function measure(elements) {
  return new Map(elements.filter((el) => el.isConnected).map((el) => [el, el.getBoundingClientRect().top]));
}

export function flip(before, name = "spatial-default") {
  for (const [el, top] of before) {
    if (!el.isConnected) continue;
    const delta = top - el.getBoundingClientRect().top;
    if (Math.abs(delta) > 0.5) animate(el, [{ transform: `translateY(${delta}px)` }, { transform: "none" }], name);
  }
}

export function enter(el) {
  animate(el, [{ opacity: 0, transform: "translateX(-12px) scale(0.94)" }, { opacity: 1, transform: "none" }], "spatial-default");
}

export async function exit(el) {
  const animation = animate(el, [
    { opacity: 1, transform: "none", height: `${el.offsetHeight}px` },
    { opacity: 0, transform: "translateX(-16px) scale(0.9)", height: "0px", minHeight: "0px", paddingTop: "0px", paddingBottom: "0px" },
  ], "spatial-fast");
  if (animation) await animation.finished.catch(() => {});
}

export function pop(el) {
  animate(el, [{ transform: "scale(0.86)" }, { transform: "none" }], "spatial-fast");
}

export async function kick(el, transform) {
  if (!el || reducedMotion()) return;
  const out = el.animate([{ transform: "none" }, { transform }], { duration: 90, easing: "cubic-bezier(0.3, 0, 0.8, 0.15)", fill: "forwards" });
  await out.finished.catch(() => {});
  animate(el, [{ transform }, { transform: "none" }], "spatial-fast");
  out.cancel();
}

export function spin(el) {
  if (!el || reducedMotion()) return;
  el.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 650, easing: spring("spatial-fast").easing });
}

export function squash(el) {
  animate(el, [{ transform: "scale(0.72) rotate(-10deg)" }, { transform: "none" }], "spatial-fast");
}

export function painted() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
