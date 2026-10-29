# Ilhas e grupos rápidos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ilhas (grupos de abas nativos do Chromium, criados na hora pela barra) e grupos salvos que se criam e editam sem passar pelo editor.

**Architecture:** Lógica pura num `islands-model.js` novo (cores, rótulo, bordas do bloco, visibilidade, decisões de arrastar e de espaço), testada com `node --test`. A lista de abas (`tab-list.js`) passa a desenhar cabeçalhos de ilha entre as abas; o `sidebar.js` lê `chrome.tabGroups`, monta menus e aplica as regras de espaço. Grupos salvos mudam só no `container-groups.js`, no `containers-model.js` e no `sidebar.js`.

**Tech Stack:** JS puro (módulos ES), API de extensão do Chromium (`chrome.tabs`, `chrome.tabGroups`), testes `node:test`, componentes Kurobe (`k-list-item`, `k-icon`).

**Spec:** `docs/superpowers/specs/2026-10-29-ilhas-e-grupos-rapidos-design.md`

## Global Constraints

- Todo texto de interface em português, no tom dos menus que já existem ("Nova ilha", "Tirar da ilha", "Adicionar à ilha X", "Desfazer ilha", "Fechar as abas da ilha", "Guardar como grupo", "Renomear", "Nova aba na ilha").
- Nenhum diálogo/popover pra criar ilha ou grupo.
- Ilha sem nome não ganha nome placeholder; o cabeçalho mostra só a cor e a contagem.
- Uma aba de um espaço nunca aparece agrupada na lista de outro espaço.
- Sem persistência própria das ilhas (nada em `chrome.storage` pra elas).
- Cores nativas aceitas: `grey, blue, red, yellow, green, pink, purple, cyan, orange`.
- Mudou `manifest.json`: subir `version` (hoje `0.4.0` → `0.5.0`).
- Testes: `cd logpose/sidebar && node --test` (é o que o `logpose-release` roda).
- Commits no estilo do repo: `Log Pose: <frase em português>` + linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Seguir o estilo do código: sem comentários, funções curtas, `Object.assign(document.createElement(...))`, classes Kurobe.

## Review Focus

1. **Aba nova aberta de dentro de uma ilha** (Ctrl+clique num link de uma aba da ilha): o Chromium põe a aba nova na ilha. Esperado: continua na ilha se for do mesmo espaço (é o caso normal). Teste: `strayTabs` não acusa aba do mesmo espaço (Task 1).
2. **Recolher a ilha que contém a aba ativa quando ela é a única coisa no espaço:** esperado abrir aba nova no espaço atual e recolher. Teste: `neighborOutside` devolve `null` quando não há vizinha (Task 1).
3. **Arrastar a última aba de uma ilha pra fora dela** (pra cima ou pra baixo do bloco): esperado sair da ilha; a ilha some se ficar vazia. Teste: `dropTarget` com o bloco de uma aba só (Task 1).
4. **Seleção múltipla e arrastar com cabeçalhos na lista:** Shift+clique e o cálculo de posição do arrastar não podem tratar o cabeçalho como aba. Verificação manual na Task 3, passo de sandbox.
5. **Ilha fechada inteira de uma vez / ilha some enquanto o menu dela está aberto:** ação do menu sobre `groupId` inexistente não pode quebrar a barra. Toda chamada `chrome.tabGroups.*`/`chrome.tabs.ungroup` sobre id vindo de menu leva `.catch(() => {})` (Task 4).

---

### Task 0: Spike — `chrome.tabGroups` funciona neste build

**Files:**
- Modify: `logpose/sidebar/manifest.json` (`permissions` + `"tabGroups"`, `version` → `0.5.0`)

- [ ] **Step 1:** Adicionar `"tabGroups"` em `permissions` e subir `version` pra `0.5.0`.
- [ ] **Step 2:** Abrir o sandbox: `logpose/bin/logpose-sandbox up && logpose/bin/logpose-sandbox open https://example.com https://example.org`.
- [ ] **Step 3:** Pela página da barra, rodar `logpose/bin/logpose-sandbox eval '(async()=>{const t=await chrome.tabs.query({currentWindow:true});const g=await chrome.tabs.group({tabIds:[t[0].id,t[1].id]});await chrome.tabGroups.update(g,{title:"x",color:"green",collapsed:false});return JSON.stringify(await chrome.tabGroups.query({}))})()' sidebar` (ajustar o nome da página conforme `logpose-sandbox` aceitar).
  Esperado: um grupo com `title:"x"`, `color:"green"`.
- [ ] **Step 4:** Recolher (`collapsed:true`) com a aba ativa dentro e anotar qual aba o Chromium ativou. Fechar e reabrir o navegador do sandbox (com "continuar de onde parei", que é o padrão do Log Pose pelo `restore-session-by-default.patch`) e conferir que `chrome.tabGroups.query({})` devolve o grupo.
- [ ] **Step 5:** Se qualquer passo falhar, PARAR e reportar (o plano todo depende disso). Se passar, commit:

```bash
git add logpose/sidebar/manifest.json
git commit -m "Log Pose: barra pede a permissão de grupos de abas"
```

---

### Task 1: `islands-model.js`

**Files:**
- Create: `logpose/sidebar/islands-model.js`
- Test: `logpose/sidebar/islands-model.test.js`

**Interfaces:**
- Produces:
  - `ISLAND_COLORS: Record<string,string>` — cor nativa → hex. `blue:"#71b1ec", green:"#7cc2a8", yellow:"#d9c08a", orange:"#d49a78", red:"#d8737a", purple:"#b59ad4"`, mais `grey`, `pink`, `cyan` com hex à escolha do implementador no mesmo tom suave.
  - `ISLAND_ORDER: string[]` — `["blue","green","yellow","orange","red","purple","cyan","pink","grey"]`.
  - `COLOR_NAMES: Record<string,string>` — `blue:"azul", green:"verde", yellow:"amarela", orange:"laranja", red:"vermelha", purple:"roxa", cyan:"ciano", pink:"rosa", grey:"cinza"`.
  - `nextColor(groups: {color:string}[]): string` — primeira de `ISLAND_ORDER` não usada; todas usadas → `ISLAND_ORDER[groups.length % 9]`.
  - `islandLabel(group: {title?:string,color:string}): string` — título aparado, ou `"Ilha " + COLOR_NAMES[color]`. (Só pra menus; o cabeçalho não usa.)
  - `islandEdges(items: {group:number|null}[]): ("first"|"middle"|"last"|"only"|"")[]` — posição de cada item no bloco de ilha consecutivo.
  - `visibleItems(items, collapsed: Set<number>)` — tira os itens de ilha recolhida.
  - `neighborOutside(items, groupId: number, activeId: number): number|null` — id da aba mais próxima de `activeId` (depois, senão antes) fora da ilha, na ordem de `items`; `null` se não houver.
  - `dropTarget(items, from: number, to: number): { join: number|null }` — onde `items` é a ordem da lista antes de soltar, `from`/`to` índices em `items`. Se o item solto fica entre dois vizinhos da mesma ilha G (considerando a ordem depois do movimento), `join: G`; se o vizinho de cima (depois do movimento) é da ilha G e o de baixo também é G, ou se a aba já era de G e algum vizinho é G, `join: G`; caso contrário `join: null` (sai).
  - `strayTabs(tabs: {id:number,groupId:number}[], spaceOf: (id)=>string): number[]` — ids de abas cuja ilha tem maioria em outro espaço (empate: fica a da aba de menor `index`/primeira); abas com `groupId <= 0` ignoradas.

- [ ] **Step 1: Testes que falham** em `islands-model.test.js` (padrão de `tabs-model.test.js`):

```js
test("próxima cor pula as usadas", () => {
  assert.equal(nextColor([]), "blue");
  assert.equal(nextColor([{ color: "blue" }, { color: "yellow" }]), "green");
});
test("todas usadas, gira", () => {
  assert.equal(nextColor(ISLAND_ORDER.map((color) => ({ color }))), "blue");
});
test("rótulo: título ou cor por extenso", () => {
  assert.equal(islandLabel({ title: " Viagem ", color: "red" }), "Viagem");
  assert.equal(islandLabel({ title: "", color: "green" }), "Ilha verde");
});
test("bordas do bloco", () => {
  const g = (...ids) => ids.map((group) => ({ group }));
  assert.deepEqual(islandEdges(g(null, 1, 1, 1, null, 2)), ["", "first", "middle", "last", "", "only"]);
  assert.deepEqual(islandEdges(g(1, 2)), ["only", "only"]);
});
test("ilha recolhida some da lista", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: 7 }];
  assert.deepEqual(visibleItems(items, new Set([7])).map((i) => i.id), [1]);
});
test("vizinha fora da ilha: depois, senão antes, senão null", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: 7 }, { id: 4, group: null }];
  assert.equal(neighborOutside(items, 7, 2), 4);
  assert.equal(neighborOutside(items.slice(0, 3), 7, 3), 1);
  assert.equal(neighborOutside(items.slice(1, 3), 7, 2), null);
});
test("soltar no meio da ilha entra", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: 7 }];
  assert.deepEqual(dropTarget(items, 0, 1), { join: 7 });
});
test("soltar fora sai", () => {
  const items = [{ id: 1, group: 7 }, { id: 2, group: 7 }, { id: 3, group: null }, { id: 4, group: null }];
  assert.deepEqual(dropTarget(items, 0, 3), { join: null });
});
test("última aba da ilha arrastada pra fora sai", () => {
  const items = [{ id: 1, group: null }, { id: 2, group: 7 }, { id: 3, group: null }];
  assert.deepEqual(dropTarget(items, 1, 2), { join: null });
  assert.deepEqual(dropTarget(items, 1, 0), { join: null });
});
test("reordenar dentro da ilha continua nela", () => {
  const items = [{ id: 1, group: 7 }, { id: 2, group: 7 }, { id: 3, group: 7 }];
  assert.deepEqual(dropTarget(items, 0, 2), { join: 7 });
});
test("aba de outro espaço na ilha é intrusa", () => {
  const space = { 1: "a", 2: "a", 3: "b", 4: "b" };
  const tabs = [{ id: 1, groupId: 7 }, { id: 2, groupId: 7 }, { id: 3, groupId: 7 }, { id: 4, groupId: -1 }];
  assert.deepEqual(strayTabs(tabs, (id) => space[id]), [3]);
});
test("aba nova do mesmo espaço na ilha não é intrusa", () => {
  const tabs = [{ id: 1, groupId: 7 }, { id: 2, groupId: 7 }];
  assert.deepEqual(strayTabs(tabs, () => "a"), []);
});
```

- [ ] **Step 2:** `cd logpose/sidebar && node --test islands-model.test.js` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar as funções acima em `islands-model.js`. Nota pro `dropTarget`: simular a lista depois do movimento (`splice` de `from` pra `to`) e olhar os vizinhos `above`/`below` do item na posição `to`; `join = above?.group != null && above.group === below?.group ? above.group : (item.group != null && (above?.group === item.group || below?.group === item.group) ? item.group : null)`.
- [ ] **Step 4:** `node --test` → todos PASS (inclusive os antigos).
- [ ] **Step 5:** Commit `Log Pose: modelo das ilhas`.

---

### Task 2: Entrada de cores/ícones no `showMenu`

**Files:**
- Modify: `logpose/sidebar/context-menu.js`
- Modify: `logpose/sidebar/sidebar.css` (estilos `.k-menu__swatches`)

**Interfaces:**
- Produces: entrada `{ swatches: { value: string, color?: string, icon?: string, selected?: boolean, title?: string }[], pick: (value: string) => void }` aceita por `showMenu`. Desenha um `li.k-menu__swatches` (role `presentation`) com um `button.k-state` redondo por opção (`background: color` se `color`; um `.k-icon` com `glyph(icon)` se `icon`), `aria-pressed` no selecionado; clique: `stopPropagation`, `hideMenu()`, `pick(value)`.

- [ ] **Step 1:** Implementar o ramo `entry.swatches` em `showMenu`, antes do `entry.heading`.
- [ ] **Step 2:** CSS: linha com `display:flex; flex-wrap:wrap; gap: var(--k-space-xxs); padding: var(--k-space-xxs) var(--k-space-sm)`; botões 22px redondos; selecionado com `outline` em `--k-color-on-surface` (mesma ideia de `.swatch[aria-pressed="true"]`, linha 188).
- [ ] **Step 3:** Verificar no sandbox: `logpose-sandbox eval` chamando `showMenu([{ swatches: [{value:"a",color:"#71b1ec",selected:true},{value:"b",color:"#d8737a"}], pick: (v)=>console.log(v) }], 50, 50)` e `logpose-sandbox shot` → linha com duas bolinhas, a primeira marcada.
- [ ] **Step 4:** `node --test` PASS; commit `Log Pose: menu com linha de cores e ícones`.

---

### Task 3: Ilhas na lista de abas

**Files:**
- Modify: `logpose/sidebar/tabs-model.js` (`toItems`: campo `group`)
- Modify: `logpose/sidebar/tabs-model.test.js`
- Modify: `logpose/sidebar/tab-list.js`
- Modify: `logpose/sidebar/sidebar.css`

**Interfaces:**
- Consumes: `islandEdges`, `visibleItems`, `ISLAND_COLORS` (Task 1).
- Produces:
  - Item de `toItems` ganha `group: number|null` (`t.groupId > 0 ? t.groupId : null`).
  - `createTabList` recebe 3 callbacks novos: `onIslandToggle(groupId)`, `onIslandRename(groupId, title)`, `onIslandMenu(groupId, x, y)`.
  - `render(items, islands = new Map())` — `islands: Map<groupId, { title: string, color: string, collapsed: boolean, count: number }>`.
  - `renameIsland(groupId)` exposto no retorno (abre o input no cabeçalho), junto com o que já existe.

- [ ] **Step 1: Teste que falha** em `tabs-model.test.js`:

```js
test("aba em ilha leva o groupId; sem ilha, null", () => {
  const [a, b] = toItems([{ id: 1, index: 0, url: "https://a", groupId: 9 }, { id: 2, index: 1, url: "https://b", groupId: -1 }], 1);
  assert.equal(a.group, 9);
  assert.equal(b.group, null);
});
```

- [ ] **Step 2:** `node --test tabs-model.test.js` → FAIL; implementar; → PASS.
- [ ] **Step 3: Cabeçalho na lista.** Em `render`, aplicar `visibleItems(items, ids das ilhas recolhidas)` e, antes da primeira aba de cada bloco (e no lugar do bloco, se recolhida), inserir um `li.island-head.k-state.k-type-label` com `dataset.island = groupId`, `--island-color` = `ISLAND_COLORS[color]`, um chip (bolinha da cor + título, se houver), contagem (`count`) e chevron (reaproveitar o visual de `.group__head`/`.group__chip`). Cabeçalhos ficam num `Map` próprio (`heads`), reaproveitados entre renders como `rows`. Clique → `onIslandToggle`; `dblclick` → `renameIsland`; `contextmenu` → `onIslandMenu`. `renameIsland` usa o mesmo padrão de `rename` (input `.tab__rename`, Enter/blur salva, Esc cancela) e chama `onIslandRename(groupId, valor aparado)` (vazio vale: tira o nome).
- [ ] **Step 4: Faixa.** `li.dataset.island = islandEdges(...)[i]` nas abas (apagar quando `""`), com `--island-color` no `li`. CSS: borda esquerda de 3px na cor e recuo como `.group__pages::before`, cantos arredondados no `first`/`last`/`only`.
- [ ] **Step 5: Cabeçalho não é aba.** Tudo que hoje lê `list.children` como abas (`select` → `order`, `selection()`, `dragTo` → `drag.rows`, `drag.step`, a comparação de `next` com `list.children` no fim do `render`) passa a usar só as `li.tab` (ex.: `list.querySelectorAll(":scope > .tab")`), e o `replaceChildren` monta abas + cabeçalhos na ordem. `drag.step` mede entre duas `.tab`. Ao soltar, `onMove(id, alvo, { from, to, items })` passa também `from`, `to` e a lista de itens visíveis (pra Task 4 decidir a ilha).
- [ ] **Step 6: Sandbox.** Criar uma ilha via `eval` (como na Task 0), `logpose-sandbox shot`: cabeçalho com cor e contagem, abas com a faixa. Conferir também com Shift+clique (`logpose-sandbox key`/mouse) que a seleção pula o cabeçalho, e que arrastar uma aba por cima do cabeçalho não quebra a posição (Review Focus 4).
- [ ] **Step 7:** `node --test` PASS; commit `Log Pose: ilhas aparecem na lista de abas`.

---

### Task 4: Ilhas no `sidebar.js` — dados, menus, recolher, arrastar, espaços

**Files:**
- Modify: `logpose/sidebar/sidebar.js`
- Modify: `logpose/sidebar/pins.js` (`pinTab` tira da ilha)
- Modify: `logpose/sidebar/container-groups.js` (`saveTab` tira da ilha)

**Interfaces:**
- Consumes: Task 1 inteira; `render(items, islands)`, callbacks e `renameIsland` da Task 3; entrada `swatches` da Task 2.
- Produces: `islandEntries(ids: number[]): menuEntry[]` e `islandMenu(groupId, x, y)` em `sidebar.js`; `ISLAND_ACTIONS` não existe — as ações moram dentro dessas duas funções. A Task 5 acrescenta "Guardar como grupo" em `islandMenu`.

- [ ] **Step 1: Dados.** Em `paint()`: `const islandList = await chrome.tabGroups.query({ windowId })`; contar membros visíveis por `group` nos `items` (antes de filtrar recolhidas) e montar o `Map` da Task 3 (`count` = abas da ilha visíveis no espaço). Passar pra `tabList.render`. Listeners: `for (const ev of ["onCreated","onUpdated","onRemoved","onMoved"]) chrome.tabGroups[ev].addListener(() => render())`.
- [ ] **Step 2: Menu da aba.** `islandEntries(ids)` devolve, antes de `groupEntries`:
  - `"divider"`, `{ heading: "Ilhas" }`;
  - se nenhuma das abas está em ilha: `{ icon: "squares-plus" (ou outro glifo Kurobe que exista; conferir em `kurobe/icons.mjs`), label: "Nova ilha", action }` — `chrome.tabs.group({ tabIds: ids, createProperties: { windowId } })` → `chrome.tabGroups.update(id, { color: nextColor(islandList) })`;
  - se alguma está em ilha: `{ icon: "log-out" (idem), label: "Tirar da ilha", action: () => chrome.tabs.ungroup(ids) }`;
  - pra cada ilha com membros no espaço atual e que não é a ilha de todas as `ids`: `{ icon: "circle", label: "Adicionar à ilha " + ... }` — usar `islandLabel(g)` no rótulo: `Adicionar a ${islandLabel(g)}` se tiver título, `Adicionar à ${islandLabel(g).toLowerCase()}` sem título ("Adicionar à ilha verde"); action `chrome.tabs.group({ groupId: g.id, tabIds: ids })`.
  - Chamar `tabList.clearSelection()` nas ações, como `groupEntries` faz. Ligar em `tabMenu` e `tabsMenu` logo antes de `...groupEntries(...)`.
- [ ] **Step 3: Menu da ilha** (`onIslandMenu` → `islandMenu(groupId, x, y)`):
  - `{ icon: "pencil", label: "Renomear", action: () => tabList.renameIsland(groupId) }`
  - `{ swatches: ISLAND_ORDER.map((c) => ({ value: c, color: ISLAND_COLORS[c], selected: c === g.color, title: COLOR_NAMES[c] })), pick: (c) => chrome.tabGroups.update(groupId, { color: c }).catch(() => {}) }`
  - `{ icon: "plus", label: "Nova aba na ilha", action }` — cria aba como `blankTab(spaceAtual, true)` e põe na ilha (`chrome.tabs.group({ groupId, tabIds: [id] })`), depois `openLocation` como `newTabInGroup`.
  - `{ icon: "ungroup" (ou similar existente), label: "Desfazer ilha", action: () => chrome.tabs.ungroup(idsDaIlha) }`
  - `"divider"`, `{ icon: "x", label: "Fechar as abas da ilha", danger: true, action: () => closeTabs(idsDaIlha) }` (usa o `closeTabs` existente, que já dá o toast com "Desfazer").
  - `idsDaIlha` = abas da janela com `groupId === groupId`. Todas as chamadas com `.catch(() => {})` (Review Focus 5).
- [ ] **Step 4: Renomear.** `onIslandRename(id, title)` → `chrome.tabGroups.update(id, { title }).catch(() => {})`.
- [ ] **Step 5: Recolher.** `onIslandToggle(id)`: lê o grupo; se vai recolher e a aba ativa está nele, `neighborOutside(itemsVisiveis, id, ativa)` → ativa a vizinha; se `null`, `blankTab(espaçoAtual, true)` primeiro (Review Focus 2). Depois `chrome.tabGroups.update(id, { collapsed: !g.collapsed })`.
- [ ] **Step 6: Arrastar.** No `onMove` do `createTabList`: depois do `chrome.tabs.move` existente, `const { join } = dropTarget(items, from, to)`; se `join` → `chrome.tabs.group({ groupId: join, tabIds: [id] })`; senão, se a aba tem `groupId > 0` → `chrome.tabs.ungroup(id)`. Tudo com `.catch(() => {})`.
- [ ] **Step 7: Espaços.**
  - `moveTabsToSpace(ids, spaceId)`: `await chrome.tabs.ungroup(ids).catch(() => {})` antes de reatribuir.
  - Garantia: função `async function evictStrays()` que faz `chrome.tabs.query({ windowId })` e `chrome.tabs.ungroup(strayTabs(tabs, (id) => spaceOfTab(spaces, id, windowId)))` se a lista não estiver vazia. Chamar no listener `chrome.tabs.onUpdated` quando `"groupId" in info`, e no fim do `chrome.tabs.onCreated` existente (depois do `moveTabToSpace`). Guardar com `if (!ready || incognito) return` só pra o `ready`; anônima também tem espaços? Conferir: se `incognito` desliga espaços, pular lá.
- [ ] **Step 8: Fixar e guardar tiram da ilha.** Em `pins.pinTab(tab)` e em `container-groups.js` `saveTab(tab, ...)`: `if (tab.groupId > 0) await chrome.tabs.ungroup(tab.id).catch(() => {})` no começo.
- [ ] **Step 9: Sandbox** (roteiro manual, anotar o que falhar):
  1. Botão direito numa aba → "Nova ilha": cabeçalho azul, sem nome, contagem 1.
  2. Selecionar 2 abas (Ctrl+clique) → "Nova ilha": cor seguinte (verde).
  3. Duplo clique no cabeçalho, escrever "Viagem", Enter: título aparece; apagar e Enter: volta a sem nome.
  4. Menu da ilha → trocar cor: faixa e cabeçalho mudam.
  5. Recolher com a aba ativa dentro: ativa a vizinha do mesmo espaço; num espaço só com a ilha, abre aba nova.
  6. Arrastar aba pra dentro e pra fora; arrastar a última aba pra fora: a ilha some.
  7. "Mover para o espaço" numa aba da ilha: sai da ilha, aparece no outro espaço sem faixa.
  8. Fixar uma aba da ilha: contagem cai.
  9. "Fechar as abas da ilha" → toast → "Desfazer".
  10. Fechar e reabrir o sandbox: ilhas de volta no espaço certo, com nome/cor/recolhida.
- [ ] **Step 10:** `node --test` PASS; commit `Log Pose: ilhas na barra — criar, renomear, cor, recolher, arrastar`.

---

### Task 5: Guardar como grupo

**Files:**
- Modify: `logpose/sidebar/islands-model.js` + teste (`groupColorOf`)
- Modify: `logpose/sidebar/container-groups.js` (expor `createFrom`)
- Modify: `logpose/sidebar/sidebar.js` (entrada no `islandMenu`)

**Interfaces:**
- Consumes: `islandMenu` (Task 4), `createContainer`/`CONTAINER_COLORS` de `containers-model.js`, `nextGroupName` (Task 6 — se a Task 6 ainda não existir, esta task cria `nextGroupName` e a Task 6 só usa).
- Produces:
  - `groupColorOf(color: string): string` em `islands-model.js` — `ISLAND_COLORS[color]` se estiver em `CONTAINER_COLORS`, senão `CONTAINER_COLORS[0]` (grey/pink/cyan caem aí).
  - `nextGroupName(list: {name:string}[]): string` em `containers-model.js` — `"Grupo N"` com o menor N ≥ 1 cujo nome exato não existe.
  - `groups.createFrom({ name, color }, tabIds: number[]): Promise<string>` em `container-groups.js` — `save(createContainer(containers, { name, color }))`, adota cada aba (`adopt`) e devolve o id do grupo novo.

- [ ] **Step 1: Testes que falham:**

```js
// islands-model.test.js
test("cor do grupo a partir da ilha", () => {
  assert.equal(groupColorOf("green"), "#7cc2a8");
  assert.equal(groupColorOf("grey"), CONTAINER_COLORS[0]);
});
// containers-model.test.js
test("nome padrão do grupo é o menor número livre", () => {
  assert.equal(nextGroupName([]), "Grupo 1");
  assert.equal(nextGroupName([{ name: "Grupo 1" }, { name: "Grupo 3" }]), "Grupo 2");
});
```

- [ ] **Step 2:** `node --test` → FAIL; implementar `groupColorOf`, `nextGroupName`, `createFrom`; → PASS.
- [ ] **Step 3:** No `islandMenu`, fora da anônima e com `containers.available` (mesma condição de `groupEntries`): `{ icon: "save", label: "Guardar como grupo", action }` → `groups.createFrom({ name: g.title.trim() || nextGroupName(groups.list()), color: groupColorOf(g.color) }, idsDaIlha)`. O `ungroup` já acontece dentro do `saveTab` (Task 4, Step 8).
- [ ] **Step 4: Sandbox:** ilha "Viagem" verde com 2 abas → "Guardar como grupo": some da lista, aparece na seção de grupos como "Viagem" verde com as 2 páginas.
- [ ] **Step 5:** Commit `Log Pose: ilha vira grupo salvo`.

---

### Task 6: Grupos salvos rápidos

**Files:**
- Modify: `logpose/sidebar/container-groups.js`
- Modify: `logpose/sidebar/sidebar.js` (`groupEntries`)

**Interfaces:**
- Consumes: `nextGroupName` e `groups.createFrom` (Task 5), entrada `swatches` (Task 2), `CONTAINER_COLORS`/`CONTAINER_ICONS`/`updateContainer` de `containers-model.js`.
- Produces: `groups.renameGroup(containerId)` em `container-groups.js` — abre o input no cabeçalho do grupo.

- [ ] **Step 1: Criar sem editor.** Em `groupEntries`, o "Novo grupo" vira: `const id = await groups.createFrom({ name: nextGroupName(groups.list()) }, ids); groups.renameGroup(id);` (cor automática pelo `createContainer`, ícone padrão `CONTAINER_ICONS[0]`). `tabList.clearSelection()` antes, como as outras.
- [ ] **Step 2: Renomear no cabeçalho.** Em `container-groups.js`, `renameGroup(id)`: depois do próximo render (`changed()` e esperar o elemento `.group[data-id=id] .group__chip > span:last-child`), troca o nome por um input `.tab__rename` com o texto selecionado; Enter/blur salva com `updateContainer(containers, id, { name })` (vazio mantém o nome), Esc cancela. Usa a flag `renaming` que já existe pra o `render` não apagar o input. Ligar também ao `dblclick` no chip, com `stopPropagation` pra não recolher.
- [ ] **Step 3: Menu do cabeçalho.** Em `groupMenu`, antes de "Editar X": `{ icon: "pencil", label: "Renomear", action: () => renameGroup(container.id) }`, `{ swatches: CONTAINER_COLORS.map(...) , pick: (color) => save(updateContainer(containers, container.id, { color })) }`, `{ swatches: CONTAINER_ICONS.map((icon) => ({ value: icon, icon, selected: icon === container.icon })), pick: (icon) => save(updateContainer(containers, container.id, { icon })) }`.
- [ ] **Step 4: Sandbox:** botão direito numa aba → "Novo grupo": aparece "Grupo 1" com input selecionado, escrever "Trabalho" + Enter. Menu do cabeçalho: trocar cor e ícone. Duplo clique no nome renomeia. "Editar Trabalho" ainda abre o editor.
- [ ] **Step 5:** `node --test` PASS; commit `Log Pose: grupo salvo criado e editado na hora`.

---

### Task 7: Fechamento

- [ ] **Step 1:** `cd logpose/sidebar && node --test` → tudo PASS.
- [ ] **Step 2:** Repetir o roteiro da Task 4 Step 9 inteiro e o da Task 6 Step 4 num sandbox novo (`logpose-sandbox down && up`).
- [ ] **Step 3:** Se o README da barra mencionar grupos/menus de aba, atualizar uma linha; senão nada.
