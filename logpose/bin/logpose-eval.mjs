import { writeFileSync } from "node:fs";

const [port, extensionId, ...rest] = process.argv.slice(2);
const shot = rest[0] === "--shot";
const [expression, page = "sidebar.html"] = shot ? [] : rest;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.type === "page" && t.url.startsWith(`chrome-extension://${extensionId}/${page}`))
  ?? targets.find((t) => t.url.startsWith(`chrome-extension://${extensionId}/${page}`))
  ?? targets.find((t) => t.url.startsWith(`chrome-extension://${extensionId}/`));
if (!target) {
  console.error("alvo da extensão não encontrado (a barra lateral está aberta?)");
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let next = 0;
function send(method, params = {}) {
  const id = ++next;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => ws.addEventListener("message", function reply(e) {
    const message = JSON.parse(e.data);
    if (message.id !== id) return;
    ws.removeEventListener("message", reply);
    resolve(message);
  }));
}
if (shot) {
  const [, out, width, height] = rest;
  await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(result.data, "base64"));
  ws.close();
  process.exit(0);
}
const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
ws.close();
if (reply.result?.exceptionDetails) {
  console.error(reply.result.exceptionDetails.exception?.description ?? "erro");
  process.exit(1);
}
console.log(JSON.stringify(reply.result?.result?.value ?? null));
