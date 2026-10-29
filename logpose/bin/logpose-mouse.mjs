const [port, extensionId, page, ...moves] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.url.startsWith(`chrome-extension://${extensionId}/${page}`));
if (!target) {
  console.error(`alvo ${page} não encontrado`);
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let id = 0;
const TYPES = { down: "mousePressed", up: "mouseReleased", move: "mouseMoved" };
for (const move of moves) {
  const [kind, point] = move.includes(":") ? move.split(":") : ["move", move];
  const [x, y] = point.split(",").map(Number);
  const pressed = kind === "move" ? {} : { button: "left", buttons: kind === "down" ? 1 : 0, clickCount: 1 };
  ws.send(JSON.stringify({ id: ++id, method: "Input.dispatchMouseEvent", params: { type: TYPES[kind], x, y, ...pressed } }));
  await new Promise((resolve) => setTimeout(resolve, 120));
}
ws.close();
