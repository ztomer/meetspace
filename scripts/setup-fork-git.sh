#!/usr/bin/env bash
# One-time (per-clone) git configuration that makes upstream rebases sane.
# Safe to re-run — every setting is idempotent.
#
#   - rerere: records each conflict resolution and replays it automatically
#     the next time the same conflict appears (it recurs constantly because
#     the fork carries a global hypr->meetspace rename).
#   - keep-ours merge driver: backs the `merge=keep-ours` rules in
#     .gitattributes so generated/lock files resolve without conflicts.
#   - hooksPath: enables the repo's pre-push guard (.githooks/).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Enabling git rerere (reuse recorded conflict resolutions)"
git config rerere.enabled true
git config rerere.autoupdate true

echo "==> Registering 'keep-ours' merge driver (generated/lock files)"
# `true` keeps the current side and exits 0 -> no conflict markers.
git config merge.keep-ours.name "keep our version; regenerate after sync"
git config merge.keep-ours.driver true

echo "==> Pointing core.hooksPath at .githooks/"
git config core.hooksPath .githooks
chmod +x "$REPO_ROOT"/.githooks/* 2>/dev/null || true

echo "==> Done. Re-run this after a fresh clone."
