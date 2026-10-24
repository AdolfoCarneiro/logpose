# Ranga

Fork pessoal do [helium-linux](https://github.com/imputnet/helium-linux) com interface própria.

- Patches: `patches/ranga/`, listados no fim de `patches/series`.
- Código nosso: `ranga/`.
- CI: `.github/workflows/ranga-*.yml`.
- Plano: Obsidian `pessoal/dev/ranga/`.

Upstream é o remote `helium`. Atualizar: workflow `Ranga sync`.

ID da extensão sidebar: `hncljkmljckjojdjincglklbdihcaeko`

## Desenvolvimento

- Abrir o Ranga de desenvolvimento: `ranga/bin/ranga-run [url...]`.
- Testar sem mexer na tela: `ranga/bin/ranga-sandbox up | open [url...] | key <tecla> [mod...] | eval <js> [pagina] | shot <png> | theme <id> | down` (usa o `ciel-sandbox`). `RANGA_EXTRA_EXTENSIONS=<pasta>[,<pasta>]` carrega extensões a mais no `open` (ex.: uma extensão de teste com popup); `RANGA_FIRST_RUN=1` abre sem `--no-first-run`, pra testar o onboarding.
- A barra lateral é uma extensão de componente (patch `ranga/ui/sidebar-component.patch`): o navegador carrega de `--ranga-sidebar-dir=<pasta>` (os scripts passam `ranga/sidebar`) ou, sem a opção, de `<pasta do binário>/ranga-sidebar`. Não aparece em `chrome://extensions` e não pode ser desligada. Mudou JS/CSS/HTML: basta reabrir o navegador (ou recarregar a página da barra), sem build. Mudou o `background.js`: suba a `version` do `manifest.json`, senão o Chromium continua com o service worker antigo em cache.
