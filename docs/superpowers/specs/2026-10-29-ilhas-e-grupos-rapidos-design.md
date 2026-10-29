# Ilhas e grupos rápidos

## Por quê

Hoje, pra juntar abas, só existe o "Grupo" (salvo, em `container-groups.js`), e criar um exige abrir o editor (nome, ícone, cor) antes de usar. O Adolfo quer o jeito do Opera: agrupar na hora, direto da aba, e só dar nome/cor se quiser. Ele usa "continuar de onde parei", então o que importa é que a coisa volte quando o navegador reabre, não um armazenamento próprio.

Ficam dois conceitos, cada um pra uma coisa:

- **Grupo** (o que existe): guarda páginas. Fechou a aba, a página continua no grupo, apagada. Muda só o jeito de criar e editar.
- **Ilha** (nova): agrupa abas abertas. Fechou a aba, sai da ilha; fechou todas, a ilha some. É o grupo de abas nativo do Chromium (`chrome.tabGroups`), então o "continuar de onde parei" restaura as ilhas com nome, cor e recolhimento, sem código nosso de persistência.

## Objetivos

1. Criar ilha a partir de uma aba ou de várias selecionadas, num clique, sem diálogo.
2. Ilha aparece na lista de abas como bloco: cabeçalho (cor, nome opcional, contagem, recolher) e as abas dela embaixo, com faixa da cor.
3. Nome e cor da ilha editáveis no cabeçalho, na hora.
4. Mover abas pra dentro/fora da ilha pelo menu e arrastando.
5. "Guardar como grupo" transforma uma ilha num grupo salvo.
6. Criar grupo salvo direto da aba, sem passar pelo editor; renomear e trocar cor/ícone no cabeçalho do grupo.

## Fora do escopo

- Ilhas na janela anônima continuam funcionando (o nativo funciona lá), mas "Guardar como grupo" não aparece na anônima, igual aos grupos hoje.
- Nada de persistência própria das ilhas. Se o Chromium não restaurar (ex.: sem "continuar de onde parei"), a ilha não volta. Está certo assim.
- Não mexe na barra de abas horizontal do Chromium nem em patches C++.
- Não muda o modelo de dados dos grupos salvos (`containers` em `chrome.storage.local`).

## Anti-objetivos (seria falha mesmo funcionando)

- Abrir qualquer diálogo/popover pra criar ilha ou grupo.
- Ilha com nome obrigatório ou nome placeholder tipo "Ilha 1" — sem nome é sem nome; o cabeçalho mostra só a cor e a contagem.
- Tab de um espaço aparecer agrupada na lista de outro espaço.

## Como funciona

### Ilhas

**API.** Adicionar `"tabGroups"` às `permissions` do `logpose/sidebar/manifest.json` e subir a `version` (o service worker não precisa mudar, mas é a regra do README quando o manifesto muda). Criar: `chrome.tabs.group({ tabIds, createProperties: { windowId } })` e depois `chrome.tabGroups.update(groupId, { color })`. Cor automática: a primeira cor da lista que nenhuma ilha da janela está usando; se todas usadas, gira. Remover: `chrome.tabs.ungroup(ids)`. Ouvir `chrome.tabGroups.onCreated/onUpdated/onRemoved/onMoved` e `tab.groupId` (já vem em `chrome.tabs.query`) pra re-renderizar.

**Cores.** O Chromium só aceita as cores dele: `grey, blue, red, yellow, green, pink, purple, cyan, orange`. Na barra, cada uma vira uma cor do tema (tabela num `islands-model.js`, perto dos `CONTAINER_COLORS`: blue→`#71b1ec`, green→`#7cc2a8`, yellow→`#d9c08a`, orange→`#d49a78`, red→`#d8737a`, purple→`#b59ad4`, e grey/pink/cyan com tons equivalentes escolhidos pelo implementador). O seletor mostra essas 9.

**Renderização.** Em `tabs-model.js` o item ganha `group: t.groupId > 0 ? t.groupId : null`. Na lista (`tab-list.js`), abas consecutivas com o mesmo `group` formam um bloco: um `li` de cabeçalho antes da primeira aba, e as abas da ilha com uma classe que desenha a faixa da cor à esquerda (mesma ideia das bordas de `splitEdges`). Ilha recolhida: as abas dela não aparecem e o cabeçalho mostra a contagem (ver "Recolher ilha com a aba ativa" abaixo). Os dados da ilha (título, cor, recolhida) vêm de `chrome.tabGroups.query({ windowId })` no `paint()` do `sidebar.js`.

**Cabeçalho da ilha.**
- Clique: recolhe/expande (`chrome.tabGroups.update(id, { collapsed })`).
- Duplo clique no nome (ou na área vazia, se sem nome): edita o nome no lugar, com o mesmo input de `rename` das abas. Enter/blur salva, Esc cancela, vazio = sem nome.
- Botão direito: menu da ilha —
  - Renomear
  - Linha de cores (bolinhas, nova entrada do `showMenu`, ver abaixo)
  - Nova aba na ilha
  - Guardar como grupo (fora da anônima)
  - Desfazer ilha (`ungroup` de todas; as abas ficam)
  - Fechar as abas da ilha (perigo)

**Menu da aba** (`tabMenu` e `tabsMenu` em `sidebar.js`), antes do bloco "Guardar no grupo":
- Aba fora de ilha: "Nova ilha" e, se existirem ilhas no espaço atual, "Adicionar à ilha X" pra cada (rótulo = nome, ou "Ilha" + a cor por extenso se sem nome).
- Aba dentro de ilha: "Tirar da ilha" e "Adicionar à ilha X" pras outras.
- Com várias selecionadas, a mesma coisa vale pro conjunto ("Nova ilha" agrupa todas).

**Arrastar.** No `onMove` atual a aba vai pro índice do alvo. Regra nova: depois de mover, se o alvo está numa ilha e a aba caiu entre duas abas daquela ilha (ou logo antes da última dela), ela entra na ilha (`chrome.tabs.group({ groupId, tabIds })`); se foi solta fora de qualquer ilha, sai (`ungroup`). O Chromium já faz quase isso sozinho ao mover pra dentro de um bloco contíguo; o implementador confere o que o nativo faz e só completa o que faltar. Arrastar o cabeçalho da ilha (mover a ilha inteira) fica fora desta entrega.

**Espaços.** Espaços são só um filtro (`visibleTabs`); as ilhas são da janela. Regras:
- "Nova ilha" e "Adicionar à ilha" só oferecem ilhas cujas abas estão no espaço atual.
- Mover aba pra outro espaço (`moveTabsToSpace`) tira ela da ilha antes.
- Na lista, como só aparecem abas do espaço, uma ilha só aparece onde estão as abas dela. Ilha com abas em dois espaços não pode acontecer; ver "Ilha nunca atravessa espaço" abaixo.
- Restauração: o snapshot dos espaços (por URL) já devolve as abas ao espaço certo; o Chromium devolve o agrupamento. Nada a fazer, só testar.

**Guardar como grupo.** Cria um grupo salvo (`createContainer`) com o nome da ilha (ou "Grupo N" se sem nome — ver grupos abaixo) e a cor da tabela; adota cada aba (`groups.adopt`) e faz `ungroup`. As abas passam a aparecer na seção de grupos, como qualquer aba guardada.

### Grupos salvos mais fáceis

- **Menu da aba, "Novo grupo"**: em vez de `containerEditor.open()`, cria na hora com `createContainer(list, { name: "Grupo N" })` (N = menor número livre), cor automática (já é o padrão do `createContainer`) e ícone padrão; adota as abas; e já abre o rename inline no cabeçalho do grupo novo, com o texto selecionado. Se a pessoa só der Enter/clicar fora, fica "Grupo N".
- **Cabeçalho do grupo**: duplo clique no nome edita no lugar (`updateContainer`). Menu do cabeçalho ganha "Renomear", uma linha de cores (as `CONTAINER_COLORS`) e uma linha de ícones (os `CONTAINER_ICONS`), as duas usando a entrada nova do `showMenu`. "Editar X" continua no fim, abrindo o editor completo.

### Entrada nova no `showMenu`

`{ swatches: [{ value, color?, icon?, selected }], pick(value) }` desenha uma linha de botões redondos (cor de fundo ou ícone), com o selecionado marcado; clique chama `pick` e fecha o menu. Reaproveitar os estilos `.swatch`/`.choice` do editor de grupos se couber.

### Decisões tomadas na revisão (chamadas do Claude, não do Adolfo)

- **Viabilidade.** O `hide-native-chrome.patch` só deixa de desenhar a barra de abas; o modelo de abas e o `chrome.tabGroups` continuam lá. Primeira tarefa do plano: um spike no `logpose-sandbox` confirmando criar/recolher/restaurar grupo nativo neste build antes do resto.
- **Recolher ilha com a aba ativa.** Usa o recolhimento nativo (pra restaurar junto). Antes de recolher, a barra ativa ela mesma a aba vizinha mais próxima *do espaço atual* fora da ilha (ou cria uma aba nova, se não houver), pra o Chromium não pular pra uma aba de outro espaço. O "a ativa continua visível sob o cabeçalho" sai: recolhida é recolhida.
- **Ilha nunca atravessa espaço (com garantia).** Um listener em `chrome.tabs.onUpdated` (mudança de `groupId`) e `onCreated` tira da ilha qualquer aba cujo espaço é diferente do das outras abas da ilha. Assim os caminhos que o Chromium agrupa sozinho (aba nova aberta no meio do bloco, `intoSession`, `onMove`) ficam cobertos sem mexer em cada um. Aba nova criada pela barra no espaço da ilha continua entrando nela normalmente.
- **Fixar e guardar no grupo tiram da ilha.** `pins.pinTab` e `groups.adopt` fazem `ungroup` antes. Com isso, contagem, faixa, "Fechar as abas da ilha" e "Guardar como grupo" valem pras abas da ilha visíveis na lista, que passam a ser todas as do grupo nativo.

## Testes

- `islands-model.js` puro com testes `node --test` (padrão dos `*-model.test.js`): mapa de cores, próxima cor livre, rótulo da ilha sem nome, bordas do bloco (primeira/meio/última, como `splitEdges`), quais abas ficam visíveis numa ilha recolhida, decisão de entrar/sair da ilha ao soltar.
- `containers-model.js`: o "Grupo N" com menor número livre.
- Manual no `logpose-sandbox`: criar ilha, renomear, trocar cor, recolher, arrastar pra dentro/fora, mover aba de espaço, guardar como grupo, criar grupo rápido, e reiniciar o navegador com "continuar de onde parei" pra ver as ilhas voltarem no espaço certo.

## Ordem

1. Ilhas (permissão, modelo, renderização, menus, arrastar, espaços).
2. Guardar como grupo.
3. Grupos rápidos (criar sem editor, rename inline, cor/ícone no menu).

## Deixado pro implementador

Visual exato do cabeçalho e da faixa (seguir o visual dos grupos salvos e do Kurobe), animações (usar `motion.js` como o resto), tons de grey/pink/cyan, e detalhes do arrastar que o Chromium já resolve sozinho.
