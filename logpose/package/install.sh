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
    [ -d /opt/google/chrome/WidevineCdm ] && ln -sfn /opt/google/chrome/WidevineCdm "$2.new/WidevineCdm"
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
mkdir -p "$data/icons/hicolor/scalable/apps"
cp "$here/icons/icon.svg" "$data/icons/hicolor/scalable/apps/logpose.svg"
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$data/icons/hicolor" || true
command -v update-desktop-database >/dev/null && update-desktop-database -q "$data/applications" || true


mkdir -p "$profile/NativeMessagingHosts"
cat > "$profile/NativeMessagingHosts/logpose.theme.json" <<JSON
{
  "name": "logpose.theme",
  "description": "Log Pose: tema do Ciel",
  "path": "$prefix/current/theme/logpose_theme_host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://hncljkmljckjojdjincglklbdihcaeko/"]
}
JSON
onepassword="$config/chromium/NativeMessagingHosts/com.1password.1password.json"
[ -f "$onepassword" ] && cp "$onepassword" "$profile/NativeMessagingHosts/"

hooks="$config/ciel/hooks/theme-set.d"
if [ -d "$config/ciel" ]; then
  mkdir -p "$hooks"
  ln -sfn "$prefix/current/theme/hook-theme-set" "$hooks/logpose"
  "$prefix/current/theme/hook-theme-set" || true
fi

echo "Log Pose $version${build:+ ($build)} instalado em $dest"
echo "abrir: logpose   (menu de apps: Log Pose)"
