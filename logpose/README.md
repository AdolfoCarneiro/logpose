# Log Pose

Fork do [Ranga](https://github.com/taigakilla/ranga), que é um fork do [helium-linux](https://github.com/imputnet/helium-linux) com interface própria.

- Patches: `patches/logpose/`, listados no fim de `patches/series`.
- Código nosso: `logpose/`.
- Sem CI: tudo compila e é publicado da máquina.

Upstream do Helium é o remote `helium`. Atualizar: `logpose/ci/sync-upstream.sh` (traz a tag nova do helium-linux e valida os patches contra o Chromium dela); depois, se a versão do Chromium mudou, `logpose-build reset` e `setup`.

ID da extensão sidebar: `hncljkmljckjojdjincglklbdihcaeko`

## Desenvolvimento

- Abrir o Log Pose de desenvolvimento: `logpose/bin/logpose-run [url...]`.
- Testar sem mexer na tela: `logpose/bin/logpose-sandbox up | open [url...] | key <tecla> [mod...] | eval <js> [pagina] | shot <png> | theme <id> | down` (usa o `ciel-sandbox`). `LOGPOSE_EXTRA_EXTENSIONS=<pasta>[,<pasta>]` carrega extensões a mais no `open` (ex.: uma extensão de teste com popup); `LOGPOSE_FIRST_RUN=1` abre sem `--no-first-run`, pra testar o onboarding.
- A barra lateral é uma extensão de componente (patch `logpose/ui/sidebar-component.patch`): o navegador carrega de `--logpose-sidebar-dir=<pasta>` (os scripts passam `logpose/sidebar`) ou, sem a opção, de `<pasta do binário>/resources/logpose-sidebar`. Não aparece em `chrome://extensions` e não pode ser desligada. Mudou JS/CSS/HTML: basta reabrir o navegador (ou recarregar a página da barra), sem build. Mudou o `background.js` ou um módulo que ele importa (`*-model.js`): suba a `version` do `manifest.json`, senão o Chromium continua com o service worker antigo em cache.
- 1Password: o app de desktop só conversa com navegadores listados em `/etc/1password/custom_allowed_browsers` (uma linha por nome de processo: `helium` hoje, `logpose` depois do branding). O `logpose-run` copia o manifesto `com.1password.1password.json` pro `NativeMessagingHosts/` do perfil. Depois de mexer na lista, feche e reabra o 1Password.

## Build

Roda num container Debian (`logpose/bin/logpose-dev`, imagem `logpose-dev:trixie-slim`), então no Fedora só precisa de Docker, `node` (testes da barra), `zstd`, `cpio` e `gh` (release). O código do Chromium fica em `build/src`, a saída em `build/src/out/Default`.

- `logpose/bin/logpose-build setup`: uma vez. Baixa o tarball do Chromium, poda, aplica a série de patches com `quilt`, aplica a marca e roda `gn gen`. Apaga o tarball no fim (`LOGPOSE_KEEP_DOWNLOADS=1` guarda).
- `logpose/bin/logpose-build`: recompila só o que mudou, com `nice`. O primeiro leva horas; depois, minutos.
- `logpose/bin/logpose-build patches`: depois de editar ou puxar patches de `patches/`. Desaplica só a partir do primeiro patch que mudou e reaplica dali pra frente, pra não forçar rebuild do resto. Rode `build` em seguida.
- `logpose/bin/logpose-build du` mostra o espaço; `reset` apaga `build/src`.
- Um `out/` só, que serve pra testar e pra empacotar: sem component build (o pacote leva um binário só), sem o official build (o LTO deixaria cada link lento), sem DCHECK e sem símbolos (`symbol_level=0`). `LOGPOSE_OFFICIAL=1 logpose-build args` volta pro official build, e mudar os args recompila tudo.
- Pra editar um patch: `logpose/bin/logpose-dev` abre um shell no container com o `he` do Helium (`he merge`, `cd build/src`, `quilt push/pop/refresh`, `he unmerge`).

## Instalável

- Empacotar: `logpose/bin/logpose-package [OutDir]` gera `build/release/logpose-<versão>-x86_64.tar.zst` (binário sem símbolos, `resources/logpose-sidebar/`, host do tema, ícones, `.desktop`, `install.sh`). O pacote acrescenta à `version` do manifest da barra um quarto número tirado do conteúdo dela, então todo pacote com a barra mudada troca o service worker.
- Instalar: extrair e rodar `./install.sh`. Cada build vai pra `/opt/logpose/<versão>-<commit>` e o link `current` passa pra ela de uma vez, como root via `pkexec`: o 1Password só conecta com navegador cujo binário é do root. Dá pra instalar com o Log Pose aberto: a pasta em uso não é tocada, e as que ninguém usa são apagadas. Liga o `WidevineCdm` do Chrome se existir, lançador e `logpose-update` em `~/.local/bin`, atalho e ícones em `~/.local/share`, hosts nativos (tema do sistema e 1Password) em `~/.config/logpose/NativeMessagingHosts`, gancho de tema do Ciel (o denden não precisa: o host segue o `colors.toml` dele).
- `BUILD` no pacote e em `/opt/logpose/current/BUILD`: o commit (10 caracteres), com `-dirty` se havia mudança não commitada.
- Perfil: na primeira vez que o Log Pose instalado abre, o lançador copia o perfil de desenvolvimento (`~/.local/share/logpose/dev-profile`) pra `~/.config/logpose` (sem caches); se o Log Pose de desenvolvimento estiver aberto, avisa e não abre. `LOGPOSE_MIGRATE=0 logpose` começa do zero.
- O lançador exporta `LANGUAGE=pt_BR` (`LOGPOSE_LANGUAGE` troca), `CHROME_WRAPPER` e `LD_LIBRARY_PATH`, como o wrapper do Helium.

## Releases e atualização

- Publicar: `logpose/bin/logpose-release`, com a árvore limpa e o commit já na `origin/main`. Reaplica os patches que mudaram, compila, roda os testes da barra, empacota e cria a release `build-<commit>` em `AdolfoCarneiro/logpose` com o `.tar.zst` e o `.sha256`. O tag precisa ser `build-<commit>`: é por ele que o `logpose-update` sabe se está atrás.
- Atualizar: `logpose-update --check` diz se a release mais nova está à frente do commit instalado (compare do GitHub); `logpose-update` baixa, confere o sha256 e roda o `install.sh` dela. Build local de commit que o GitHub não conhece, ou `-dirty` do mesmo commit, fica como está. O `ciel update` usa isso como a fonte "Log Pose".
- Com o Log Pose aberto, a barra lateral pergunta ao host nativo se o binário em uso ainda é o `current`; se não for, mostra "Atualização instalada · Reiniciar" (reinicia com as abas, `logposePrivate.executeCommand(window, "restart")`).
