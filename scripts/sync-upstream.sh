#!/usr/bin/env bash
# Sync the fork to a new upstream release — the upstream-track model, driven by
# fork-ownership.toml so conflict resolution is deterministic (no per-file
# guessing). Run on a throwaway branch; never pushes.
#
#   git checkout -b sync/1.0.46 MIT_BACK
#   scripts/sync-upstream.sh desktop_v1.0.46
#
# What it does:
#   1. Rebuild `upstream-track` = <tag> + meetspace rebrand (regenerable).
#   2. Rebase the fork commits onto it, auto-resolving conflicts via
#      scripts/resolve-conflicts.py (ownership manifest); skip emptied commits.
#   3. Reconcile package.json deps + rebrand + regenerate + verify.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
source "$REPO_ROOT/scripts/i18n-guard.sh"
TAG="${1:?usage: sync-upstream.sh <upstream-ref, e.g. desktop_v1.0.46>}"
FORK_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ORIG_FORK="$(git rev-parse "$FORK_BRANCH")"   # pre-rebase fork tip (enforcement source)

bash scripts/setup-fork-git.sh >/dev/null

# Snapshot the resolver + reconciler + manifest OUTSIDE the tree NOW, while still
# on the fork branch (upstream-track and the early rebased commits don't contain
# them). The rebase loop / enforce / reconcile steps run from this snapshot,
# pointed at the snapshot manifest via env.
SNAP="$(mktemp -d)"
cp scripts/resolve-conflicts.py "$SNAP/resolve-conflicts.py"
cp scripts/reconcile-package.py "$SNAP/reconcile-package.py"
cp scripts/reconcile-cargo.py "$SNAP/reconcile-cargo.py"
cp fork-ownership.toml "$SNAP/fork-ownership.toml"
trap 'rm -rf "$SNAP"' EXIT
RESOLVE() { FORK_OWNERSHIP_TOML="$SNAP/fork-ownership.toml" python3 "$SNAP/resolve-conflicts.py" "$@"; }

echo "==> Rebuilding upstream-track at $TAG (+ meetspace rebrand)"
git fetch --tags --prune origin
PREV_TRACK="$(git rev-parse --verify -q refs/heads/upstream-track || true)"
[ -n "$PREV_TRACK" ] || { echo "no upstream-track branch; create it first"; exit 1; }
# Drift guard: re-running after upstream-track was already advanced to $TAG makes
# PREV_TRACK the WRONG base (it would replay nothing / the wrong range). Refuse
# and tell the operator to reset the branch to the PREVIOUS release track.
if git log -1 --format=%s "$PREV_TRACK" 2>/dev/null | grep -qF "upstream-track: $TAG "; then
  echo "ERROR: upstream-track is already at $TAG — PREV_TRACK would be wrong."
  echo "Reset it to the previous release track, then re-run:"
  echo "  git branch -f upstream-track <previous-track-sha>"
  exit 1
fi
git checkout -B upstream-track "$TAG"
git checkout "$FORK_BRANCH" -- scripts/rebrand_sweep.py
python3 scripts/rebrand_sweep.py
git checkout "$TAG" -- scripts 2>/dev/null || true
rm -f scripts/rebrand_sweep.py
git add -A && git commit -q -m "upstream-track: $TAG + meetspace rebrand"

echo "==> Rebasing $FORK_BRANCH onto upstream-track (ownership-driven)"
git checkout "$FORK_BRANCH"
GIT_EDITOR=true git rebase --onto upstream-track "$PREV_TRACK" "$FORK_BRANCH" >/dev/null 2>&1
for _ in $(seq 1 400); do
  [ -d .git/rebase-merge ] || break
  RESOLVE
  out="$(GIT_EDITOR=true git rebase --continue 2>&1)"
  if echo "$out" | grep -qiE 'no changes|nothing to commit|patch is empty|meant to go into a new commit'; then
    GIT_EDITOR=true git rebase --skip >/dev/null 2>&1
  fi
done
[ -d .git/rebase-merge ] && { echo "rebase still in progress — resolve manually"; exit 1; }

echo "==> Enforce fork ownership (restore fork-owned files; apply delete-list)"
# git auto-merge can silently drop fork content in fork-owned files, and new
# upstream files slip into deleted dirs — neither shows up as a conflict.
RESOLVE --enforce "$ORIG_FORK"

echo "==> Restore regenerable keep-ours files from upstream-track (clean)"
# The .gitattributes keep-ours driver doesn't reliably apply during a scripted
# rebase, leaving conflict markers in lock/catalog files. They all regenerate
# below (cargo / pnpm install / i18n), so reset them to the clean upstream-track
# copy rather than fight the driver.
git checkout upstream-track -- Cargo.lock pnpm-lock.yaml apps/desktop/src/i18n/locales 2>/dev/null || true

echo "==> Reconcile package.json (preserve fork scripts/deps; add/remove per manifest)"
FORK_OWNERSHIP_TOML="$SNAP/fork-ownership.toml" python3 "$SNAP/reconcile-package.py" "$ORIG_FORK" "$TAG"

echo "==> Reconcile root Cargo.toml (drop deleted members; restore fork plugin deps)"
FORK_OWNERSHIP_TOML="$SNAP/fork-ownership.toml" python3 "$SNAP/reconcile-cargo.py" "$ORIG_FORK" "$TAG"

echo "==> Rebrand sweep + format + install + regenerate"
python3 scripts/rebrand_sweep.py
pnpm exec dprint fmt >/dev/null 2>&1 || true
pnpm install
# extract BEFORE compile (and extract runs --clean to drop obsolete stale
# "Anarlog" msgids — lingui compile includes obsolete entries, which would
# otherwise re-introduce "Anarlog" into the catalog). Taking upstream's catalogs
# also drops fork-added message IDs, so without a re-extract the fork's strings
# render as raw lingui hashes. After compile, the shared guard (i18n-guard.sh)
# warns on missing fork keys.
pnpm -F desktop i18n:extract || echo "(i18n:extract failed — run manually)"
pnpm -F desktop i18n:compile || echo "(run i18n:compile manually)"
i18n_guard warn
pnpm -F @meetspace/ui build || true

echo "==> Verify"
pnpm -F desktop typecheck
cargo check --workspace
python3 scripts/check-clean.py
echo
echo "==> Synced $FORK_BRANCH to $TAG. NEXT (manual):"
echo "    - confirm llm/shared.tsx wires the local-provider allowlist (hide cloud)"
echo "    - run the app + 'pnpm -F desktop visual:update' to refresh baselines"
echo "    - 'pnpm smoke' — launch sanity (catches runtime panics typecheck can't)"
echo "    - review, then fast-forward MIT_BACK + push"
