#!/usr/bin/env bash
# Fork hygiene guard. Fails (exit 1) if the working tree contains:
#   1. leftover merge-conflict markers, or
#   2. un-rebranded upstream identifiers in source code.
#
# Run by the pre-push hook, by scripts/rebase-on-main.sh, and in CI.
# The two things that silently broke past rebases — this catches both.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fail=0

echo "==> Checking for conflict markers"
markers=$(git grep -lE '^(<{7}|>{7}|\|{7}) ' -- . 2>/dev/null || true)
if [ -n "$markers" ]; then
  echo "FAIL: conflict markers present in:"
  echo "$markers" | sed 's/^/  /'
  fail=1
else
  echo "  ok"
fi

echo "==> Checking for un-rebranded upstream identifiers in code"
# Code dirs only; translation catalogs and historical changelogs legitimately
# retain old strings, and the rebrand tooling itself names the patterns.
leaks=$(git grep -lE '@meetspace/|meetspace_|meetspace-|Meetspace|MEETSPACE|com\.meetspace|[Aa]narlog|MEETSPACE' -- \
  'apps/**' 'crates/**' 'packages/**' 'plugins/**' \
  ':(exclude)**/i18n/locales/**' \
  ':(exclude)packages/changelog/content/**' \
  2>/dev/null || true)
if [ -n "$leaks" ]; then
  echo "FAIL: upstream identifiers found (run: python3 scripts/rebrand_sweep.py):"
  echo "$leaks" | sed 's/^/  /'
  fail=1
else
  echo "  ok"
fi

if [ "$fail" = "1" ]; then
  echo "==> check-clean FAILED"
  exit 1
fi
echo "==> check-clean passed"
