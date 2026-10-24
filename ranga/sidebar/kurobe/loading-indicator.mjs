export const PROFILES = [
  [12, 0.07, 2, 1], [9, 0.10, 2, 1], [5, 0.11, 2, 1],
  [0, 0, 4, 0.62], [8, 0.10, 2, 1], [4, 0.17, 2, 1], [0, 0, 2, 0.74],
];

export function radius(profile, angle) {
  const [lobes, depth, exponent, squash] = profile;
  if (lobes > 0) return (1 + depth * Math.cos(lobes * angle)) / (1 + depth);
  const c = Math.abs(Math.cos(angle)) ** exponent;
  const s = (Math.abs(Math.sin(angle)) / squash) ** exponent;
  return (c + s) ** (-1 / exponent);
}

export function shapePoints(phase, size, ratio, samples) {
  const count = PROFILES.length;
  const safe = Math.max(0, phase);
  const segment = Math.floor(safe) % count;
  const raw = safe - Math.floor(safe);
  const t = raw * raw * (3 - 2 * raw);
  const from = PROFILES[segment];
  const to = PROFILES[(segment + 1) % count];
  const turn = ((safe * 0.9 * Math.PI * 2) / count) * 2;
  const half = (size * ratio) / 2;
  const points = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const r = radius(from, a) * (1 - t) + radius(to, a) * t;
    const b = a + turn;
    points.push([size / 2 + half * r * Math.cos(b), size / 2 + half * r * Math.sin(b)]);
  }
  return points;
}

export function pathFrom(points) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join("") + "Z";
}

const SVG = "http://www.w3.org/2000/svg";

if (typeof HTMLElement !== "undefined" && !customElements.get("k-loading-indicator")) {
  customElements.define("k-loading-indicator", class extends HTMLElement {
    connectedCallback() {
      const size = Number(this.getAttribute("size") || 24);
      const contained = this.hasAttribute("contained");
      this.style.display = "inline-grid";
      this.style.width = this.style.height = `${size}px`;
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
      if (contained) {
        const circle = document.createElementNS(SVG, "circle");
        circle.setAttribute("cx", size / 2);
        circle.setAttribute("cy", size / 2);
        circle.setAttribute("r", size / 2);
        circle.setAttribute("fill", "var(--k-color-primary-container)");
        svg.append(circle);
      }
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("fill", contained ? "var(--k-color-on-primary-container)" : "var(--k-color-primary)");
      svg.append(path);
      this.replaceChildren(svg);
      const started = performance.now();
      const tick = (now) => {
        if (!this.isConnected) return;
        path.setAttribute("d", pathFrom(shapePoints((now - started) / 700, size, contained ? 0.62 : 1, 56)));
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.frame);
    }
  });
}
