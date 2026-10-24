#!/usr/bin/env bash
set -euo pipefail

upstream="${RANGA_UPSTREAM:-https://github.com/imputnet/helium-linux.git}"
git remote get-url helium >/dev/null 2>&1 || git remote add helium "$upstream"
git fetch --quiet --tags helium

latest="$(git tag -l '[0-9]*.[0-9]*.[0-9]*.[0-9]*' | sort -V | tail -n1)"

validate() {
  git submodule update --init --recursive
  python3 helium-chromium/devutils/update_platform_patches.py merge patches
  trap 'python3 helium-chromium/devutils/update_platform_patches.py unmerge patches' EXIT
  python3 ranga/ci/check_patches.py patches/series.merged patches helium-chromium/chromium_version.txt
}

if git merge-base --is-ancestor "$latest" HEAD; then
  if [ "${RANGA_FORCE_VALIDATE:-}" = 1 ]; then
    validate
    echo "validated $latest"
  else
    echo "up-to-date $latest"
  fi
  exit 0
fi

git merge --no-edit "$latest"
validate
echo "merged $latest"
