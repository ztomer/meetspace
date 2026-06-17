#!/usr/bin/env bash
# Sync the fork to a new upstream release, using the upstream-track model.
#
# Model: `upstream-track` is a REGENERATED branch = a chosen upstream release
# with the meetspace rebrand applied (so it shares the fork's naming). The fork
# branch is just a couple of commits on top of it. Rebasing those commits onto a
# freshly-rebuilt upstream-track means conflicts are SUBSTANTIVE only — the
# hypr→meetspace rename never conflicts, because both sides are already meetspace.
#
#   scripts/sync-upstream.sh desktop_v1.0.45
#
# Never pushes. Run on a throwaway branch first.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
TAG="${1:?usage: sync-upstream.sh <upstream-ref, e.g. desktop_v1.0.45>}"
FORK_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

bash scripts/setup-fork-git.sh >/dev/null   # rerere + merge drivers + hooks

echo "==> Rebuilding upstream-track at $TAG (+ meetspace rebrand)"
git fetch --tags --prune origin
PREV_TRACK=$(git rev-parse --verify -q refs/heads/upstream-track || true)
git checkout -B upstream-track "$TAG"
git checkout "$FORK_BRANCH" -- scripts/rebrand_sweep.py
python3 scripts/rebrand_sweep.py
git checkout "$TAG" -- scripts 2>/dev/null || true
rm -f scripts/rebrand_sweep.py
git add -A
git commit -q -m "upstream-track: $TAG + meetspace rebrand"

echo "==> Rebasing $FORK_BRANCH onto the new upstream-track"
git checkout "$FORK_BRANCH"
# Rebase only the fork's own commits (everything since the previous upstream-track).
if [ -n "$PREV_TRACK" ]; then
  git rebase --onto upstream-track "$PREV_TRACK" "$FORK_BRANCH" || {
    echo "Conflicts — resolve (UI→upstream, fork-unique→keep, commercial→strip per docs/SYNCING.md),"
    echo "then: git rebase --continue. rerere + drivers handle the repetitive/generated bits."
    exit 1
  }
else
  echo "No previous upstream-track ref; rebase the fork commits onto upstream-track manually."
  exit 1
fi

echo "==> Post-steps: re-strip commercial, regen i18n, verify"
python3 scripts/rebrand_sweep.py
pnpm -F desktop i18n:compile || echo "(run i18n:compile manually)"
pnpm exec dprint fmt
pnpm -F @meetspace/ui build
pnpm -F desktop typecheck
cargo check
bash scripts/check-clean.sh
echo "==> Synced $FORK_BRANCH to $TAG. Review, then push when satisfied."
