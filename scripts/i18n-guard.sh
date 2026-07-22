#!/usr/bin/env bash
# Shared i18n catalog guard for the meetspace fork.
#
# The desktop build compiles catalogs from the committed en/messages.ts. Two
# failure modes must never ship:
#   1. stale "Anarlog" strings — a bare `i18n:compile` compiles OBSOLETE (#~)
#      msgids that linger in the upstream .po files, so the regenerated en.ts
#      carries "Anarlog" text; and
#   2. drift from the fork's source — the fork adds settings sections (e.g.
#      Integrations, Personalization) whose message IDs must be present, or the
#      UI renders raw lingui hashes.
#
# Source this file and call `i18n_guard <mode>`:
#   i18n_guard abort   -> print an Error and return 1 (use in release; `set -e`
#                         makes the caller exit before building).
#   i18n_guard warn    -> print a Warning and return 0 (use in rebase/sync, where
#                         a human inspects the result before releasing).
#
# To add a new fork settings section, append its message ID to I18N_FORK_KEYS
# HERE — all three call sites (local-release / rebase-on-main / sync-upstream)
# pick it up automatically.

# Fork-added message IDs that MUST be present in en/messages.ts.
I18N_FORK_KEYS=(nbfdhU VrNltZ iDNBZe LMUw1U Gzw2pq 9cDpsw)

# Repo root resolved at source time (when BASH_SOURCE has a stack frame).
# Fallback to pwd for interactive testing.
if [ -n "${BASH_SOURCE[0]}" ]; then
  _I18N_GUARD_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
else
  _I18N_GUARD_REPO="$(pwd)"
fi

i18n_guard() {
  local mode="${1:-warn}"
  local en_ts="${_I18N_GUARD_REPO}/apps/desktop/src/i18n/locales/en/messages.ts"

  if [ ! -f "$en_ts" ]; then
    echo "i18n guard: en catalog not found at $en_ts" >&2
    [ "$mode" = "abort" ] && return 1
    return 0
  fi

  local problems=()
  if grep -q "Anarlog" "$en_ts"; then
    problems+=("en catalog contains 'Anarlog' (stale upstream .po compiled in)")
  fi
  local missing=()
  for key in "${I18N_FORK_KEYS[@]}"; do
    grep -q "$key" "$en_ts" || missing+=("$key")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    problems+=("en catalog missing fork keys: ${missing[*]}")
  fi

  if [ "${#problems[@]}" -gt 0 ]; then
    local msg="i18n catalog problem — ${problems[*]}"
    if [ "$mode" = "abort" ]; then
      echo "Error: $msg" >&2
      echo "Fix: pnpm -F desktop i18n:extract && pnpm -F desktop i18n:compile, then commit." >&2
      return 1
    fi
    echo "Warning: $msg" >&2
    return 0
  fi
  return 0
}
