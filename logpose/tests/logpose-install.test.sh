#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install="$here/../bin/logpose-install"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/stub" "$tmp/pkg/helium-9.9.9.9-x86_64_linux"
cat > "$tmp/pkg/helium-9.9.9.9-x86_64_linux/helium" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@"
EOF
chmod +x "$tmp/pkg/helium-9.9.9.9-x86_64_linux/helium"
tar -cJf "$tmp/helium-9.9.9.9-x86_64_linux.tar.xz" -C "$tmp/pkg" helium-9.9.9.9-x86_64_linux

cat > "$tmp/stub/gh" <<EOF
#!/usr/bin/env bash
case "\$1 \$2" in
  "run list") echo 4242 ;;
  "run download")
    dest=""
    while [ \$# -gt 0 ]; do [ "\$1" = "-D" ] && dest="\$2"; shift; done
    if [ "\${FAKE_EMPTY:-}" != 1 ]; then
      mkdir -p "\$dest/helium-9.9.9.9-x86_64-linux"
      cp "$tmp/helium-9.9.9.9-x86_64_linux.tar.xz" "\$dest/helium-9.9.9.9-x86_64-linux/"
    fi ;;
esac
EOF
chmod +x "$tmp/stub/gh"

export PATH="$tmp/stub:$PATH"
export LOGPOSE_PREFIX="$tmp/opt" LOGPOSE_BINDIR="$tmp/bin" LOGPOSE_PROFILE="$tmp/profile"

out="$("$install")"
[ "$out" = "helium-9.9.9.9-x86_64" ] || { echo "FAIL: versão impressa '$out'"; exit 1; }
[ "$(readlink "$tmp/opt/current")" = "$tmp/opt/helium-9.9.9.9-x86_64" ] || { echo "FAIL: current"; exit 1; }
args="$("$tmp/bin/logpose" --foo)"
grep -qx -- "--user-data-dir=$tmp/profile" <<<"$args" || { echo "FAIL: user-data-dir"; exit 1; }
grep -qx -- "--class=logpose" <<<"$args" || { echo "FAIL: class"; exit 1; }
grep -qx -- "--foo" <<<"$args" || { echo "FAIL: repasse de argumentos"; exit 1; }

if FAKE_EMPTY=1 "$install" 2>"$tmp/err"; then echo "FAIL: deveria falhar sem tarball"; exit 1; fi
grep -q "artefato sem tar.xz" "$tmp/err" || { echo "FAIL: mensagem de erro"; exit 1; }

echo PASS
