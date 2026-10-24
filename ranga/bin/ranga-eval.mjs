const [port, extensionId, expression] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.url.startsWith(`chrome-extension://${extensionId}/sidebar.html`))
  ?? targets.find((t) => t.url.startsWith(`chrome-extension://${extensionId}/`));
if (!target) {
  console.error("alvo da extensão não encontrado (a barra lateral está aberta?)");
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
const reply = await new Promise((resolve) => ws.addEventListener("message", (e) => resolve(JSON.parse(e.data))));
ws.close();
if (reply.result?.exceptionDetails) {
  console.error(reply.result.exceptionDetails.exception?.description ?? "erro");
  process.exit(1);
}
console.log(JSON.stringify(reply.result?.result?.value ?? null));
