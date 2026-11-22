#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
version="$(cat "$here/VERSION")"
build="$(cat "$here/BUILD" 2>/dev/null || true)"
prefix="${LOGPOSE_PREFIX:-/opt/logpose}"
bindir="${LOGPOSE_BINDIR:-$HOME/.local/bin}"
data="${XDG_DATA_HOME:-$HOME/.local/share}"
config="${XDG_CONFIG_HOME:-$HOME/.config}"
profile="$config/logpose"

dest="$prefix/$version${build:+-$build}"
allowed=/etc/1password/custom_allowed_browsers
as_root=()
mkdir -p "$prefix" 2>/dev/null && [ -w "$prefix" ] || as_root=(pkexec)
"${as_root[@]}" bash -euc '
  if ! pgrep -f "^$2/" >/dev/null; then
    rm -rf "$2.new"
    mkdir -p "$2.new"
    cp -a "$1/app/." "$2.new/"
    rm -rf "$2"
    mv "$2.new" "$2"
  fi
  [ "$(id -u)" = 0 ] && chown -R root:root "$3"
  ln -sfn "$2" "$3/current.new"
  mv -T "$3/current.new" "$3/current"
  for old in "$3"/*; do
    [ -d "$old" ] && [ ! -L "$old" ] && [ "$old" != "$2" ] || continue
    pgrep -f "^$old/" >/dev/null || rm -rf "$old"
  done
  if [ "$(id -u)" = 0 ] && [ -d /opt/1Password ] && ! grep -qx logpose "$4" 2>/dev/null; then
    mkdir -p "$(dirname "$4")"
    echo logpose >> "$4"
    chmod 755 "$4"
  fi
' _ "$here" "$dest" "$prefix" "$allowed"

mkdir -p "$bindir"
install -m 755 "$here/logpose-update" "$bindir/logpose-update"
install -m 755 "$here/logpose-widevine" "$bindir/logpose-widevine"
# Widevine (Netflix, HBO, Spotify) no perfil, baixado do Google: o build não lê um ao lado do binário
LOGPOSE_PREFIX="$prefix" LOGPOSE_PROFILE="$profile" "$bindir/logpose-widevine" || echo "vídeo com DRM fica pra próxima: logpose-widevine" >&2
cat > "$bindir/logpose" <<LAUNCHER
#!/usr/bin/env bash
profile="$profile"
dev_profile="$data/logpose/dev-profile"
if [ ! -e "\$profile/Local State" ] && [ -d "\$dev_profile" ] && [ "\${LOGPOSE_MIGRATE:-1}" = 1 ]; then
  if pgrep -f -- "--user-data-dir=\$dev_profile" >/dev/null; then
    notify-send -a Log Pose Log Pose "Feche o Log Pose de desenvolvimento pra trazer suas abas, logins e extensões" 2>/dev/null \\
      || echo "feche o Log Pose de desenvolvimento pra trazer o perfil" >&2
    exit 1
  fi
  mkdir -p "\$profile"
  cp -an "\$dev_profile/." "\$profile/"
  rm -rf "\$profile"/Singleton* "\$profile/Default/Cache" "\$profile/Default/Code Cache" "\$profile/Default/GPUCache" "\$profile/ShaderCache" "\$profile/GrShaderCache"
fi
export LANGUAGE="\${LOGPOSE_LANGUAGE:-pt_BR}"
export CHROME_WRAPPER="$bindir/logpose"
export LD_LIBRARY_PATH="$prefix/current\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
exec "$prefix/current/logpose" "\$@"
LAUNCHER
chmod +x "$bindir/logpose"

mkdir -p "$data/applications"
sed "s#@BIN@#$bindir/logpose#g" "$here/logpose.desktop" > "$data/applications/logpose.desktop"
for size in 16 22 24 32 48 64 128 256 512; do
  mkdir -p "$data/icons/hicolor/${size}x${size}/apps"
  cp "$here/icons/icon-$size.png" "$data/icons/hicolor/${size}x${size}/apps/logpose.png"
done
# Sem scalable/: o icon.svg só embrulha um PNG, e o Qt reduz esse <image> sem suavizar
# (fica serrilhado na barra). Com só os PNGs ele escolhe o tamanho mais perto e suaviza.
rm -f "$data/icons/hicolor/scalable/apps/logpose.svg"
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$data/icons/hicolor" || true
command -v update-desktop-database >/dev/null && update-desktop-database -q "$data/applications" || true


mkdir -p "$profile/NativeMessagingHosts"
cat > "$profile/NativeMessagingHosts/logpose.theme.json" <<JSON
{
  "name": "logpose.theme",
  "description": "Log Pose: tema do sistema",
  "path": "$prefix/current/theme/logpose_theme_host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://hncljkmljckjojdjincglklbdihcaeko/"]
}
JSON
onepassword="$config/chromium/NativeMessagingHosts/com.1password.1password.json"
[ -f "$onepassword" ] && cp "$onepassword" "$profile/NativeMessagingHosts/"

"$prefix/current/theme/update-theme" || true

# Picture-in-picture por cima de tudo: no Wayland o Chromium não consegue pedir isso
# (SetZOrderLevel é vazio lá), então quem segura a janelinha em cima é uma regra do KWin.
if command -v kwriteconfig6 >/dev/null && command -v kreadconfig6 >/dev/null; then
  rule=logpose-pip
  w() { kwriteconfig6 --file kwinrulesrc --group "$rule" --key "$1" "$2"; }
  w Description "Log Pose: picture-in-picture por cima"
  w wmclass logpose
  w wmclassmatch 1
  w title '^Picture[ -]in[ -][Pp]icture$'
  w titlematch 3
  w above true
  w aboverule 2
  rules="$(kreadconfig6 --file kwinrulesrc --group General --key rules)"
  case ",$rules," in
    *",$rule,"*) ;;
    *) rules="${rules:+$rules,}$rule"
       kwriteconfig6 --file kwinrulesrc --group General --key rules "$rules"
       kwriteconfig6 --file kwinrulesrc --group General --key count "$(tr ',' '\n' <<<"$rules" | grep -c .)" ;;
  esac
  dbus-send --session --type=method_call --dest=org.kde.KWin /KWin org.kde.KWin.reconfigure 2>/dev/null || true
fi

echo "Log Pose $version${build:+ ($build)} instalado em $dest"
echo "abrir: logpose   (menu de apps: Log Pose)"
