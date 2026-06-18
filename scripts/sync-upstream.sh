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
TAG="${1:?usage: sync-upstream.sh <upstream-ref, e.g. desktop_v1.0.46>}"
FORK_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

bash scripts/setup-fork-git.sh >/dev/null

# Snapshot the resolver + manifest OUTSIDE the tree NOW, while still on the fork
# branch (upstream-track and the early rebased commits don't contain them). The
# rebase loop runs the resolver from this snapshot, pointed at the snapshot
# manifest via env.
SNAP="$(mktemp -d)"
cp scripts/resolve-conflicts.py "$SNAP/resolve-conflicts.py"
cp fork-ownership.toml "$SNAP/fork-ownership.toml"
trap 'rm -rf "$SNAP"' EXIT

echo "==> Rebuilding upstream-track at $TAG (+ meetspace rebrand)"
git fetch --tags --prune origin
PREV_TRACK="$(git rev-parse --verify -q refs/heads/upstream-track || true)"
[ -n "$PREV_TRACK" ] || { echo "no upstream-track branch; create it first"; exit 1; }
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
  FORK_OWNERSHIP_TOML="$SNAP/fork-ownership.toml" python3 "$SNAP/resolve-conflicts.py"
  out="$(GIT_EDITOR=true git rebase --continue 2>&1)"
  if echo "$out" | grep -qiE 'no changes|nothing to commit|patch is empty|meant to go into a new commit'; then
    GIT_EDITOR=true git rebase --skip >/dev/null 2>&1
  fi
done
[ -d .git/rebase-merge ] && { echo "rebase still in progress — resolve manually"; exit 1; }

echo "==> Reconcile package.json deps (add fork deps / remove commercial)"
python3 - <<'PY'
import json, tomllib
m = tomllib.load(open("fork-ownership.toml", "rb")).get("deps", {})
p = "apps/desktop/package.json"
d = json.load(open(p))
dep = d.setdefault("dependencies", {})
for k in m.get("remove", []):
    dep.pop(k, None)
    d.get("devDependencies", {}).pop(k, None)
for k in m.get("add", []):
    dep.setdefault(k, "*")
d["dependencies"] = dict(sorted(dep.items()))
json.dump(d, open(p, "w"), indent=2)
open(p, "a").write("\n")
print("deps reconciled")
PY

echo "==> Rebrand sweep + format + install + regenerate"
python3 scripts/rebrand_sweep.py
pnpm exec dprint fmt >/dev/null 2>&1 || true
pnpm install
pnpm -F desktop i18n:compile || echo "(run i18n:compile manually)"
pnpm -F @meetspace/ui build || true

echo "==> Verify"
pnpm -F desktop typecheck
cargo check --workspace
python3 scripts/check-clean.py
echo
echo "==> Synced $FORK_BRANCH to $TAG. NEXT (manual):"
echo "    - confirm llm/shared.tsx wires the local-provider allowlist (hide cloud)"
echo "    - run the app + 'pnpm -F desktop visual:update' to refresh baselines"
echo "    - review, then fast-forward MIT_BACK + push"
