#!/usr/bin/env bash
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../sidebar" && pwd)"
status=0
for file in "$dir"/*.js "$dir"/kurobe/*.mjs; do
  [[ "$file" == *.test.js ]] && continue
  node --input-type=module --check < "$file" 2>/dev/null || { echo "erro de sintaxe: $file"; node --input-type=module --check < "$file" 2>&1 | head -5; status=1; }
done
node --test "$dir"/*.test.js 2>&1 | grep -E "^ℹ (pass|fail)"
exit $status
