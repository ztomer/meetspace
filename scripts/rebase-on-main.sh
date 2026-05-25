#!/usr/bin/env bash
# Rebase this local-only fork on upstream main, then validate.
#
# Assumes the current `origin` remote points at upstream anarlog. We do NOT
# push from this script — a new origin will be added later by the maintainer.
# See docs/FORK_PLAN.md and docs/_REMOVED_AUTH.md for context.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-origin}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

bold "==> Pre-rebase checks"

if ! git diff-index --quiet HEAD --; then
  red "Working tree is dirty. Commit or stash before rebasing."
  git status --short
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
green "On branch: $CURRENT_BRANCH"
green "Fetching $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

bold "==> Rebasing on $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
if ! git rebase "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"; then
  red "Rebase has conflicts."
  yellow "Check docs/_REMOVED_AUTH.md — most conflicts are upstream resurrecting files we deleted."
  yellow "Resolve them, then run: $0 --continue"
  exit 1
fi

bold "==> Re-removing files in docs/_REMOVED_AUTH.md that upstream may have reintroduced"

# Directories that should stay deleted in this fork.
REMOVED_DIRS=(
  "apps/api"
  "apps/stripe"
  "apps/web"
  "supabase"
  "packages/supabase"
  "packages/pricing"
  "apps/desktop/src/billing"
  "apps/desktop/src/onboarding/account"
)

# Individual files that should stay deleted.
REMOVED_FILES=(
  "apps/desktop/src/auth/client.ts"
  "apps/desktop/src/auth/errors.ts"
  "apps/desktop/src/shared/config/configure-paid-settings.ts"
  "apps/desktop/src/stt/useUploadAudio.ts"
  "apps/desktop/src/settings/general/account.tsx"
  "apps/desktop/src/sidebar/profile/auth.tsx"
  ".infisical.json"
  "doxxer.api.toml"
  "doxxer.cli.toml"
  "doxxer.stripe.toml"
  "doxxer.web.toml"
  "openstatus.lock"
  "openstatus.yaml"
  "render.yaml"
  "bitrise.yml"
)

resurrected=0
for d in "${REMOVED_DIRS[@]}"; do
  if [ -d "$d" ]; then
    yellow "  re-removing dir: $d"
    git rm -rf "$d" >/dev/null
    resurrected=1
  fi
done
for f in "${REMOVED_FILES[@]}"; do
  if [ -f "$f" ]; then
    yellow "  re-removing file: $f"
    git rm "$f" >/dev/null
    resurrected=1
  fi
done

if [ "$resurrected" = "1" ]; then
  yellow "Some deletions were re-applied. Review and commit them."
  git status --short
fi

bold "==> pnpm install"
pnpm install --frozen-lockfile=false

bold "==> pnpm -F desktop typecheck"
pnpm -F desktop typecheck

bold "==> cargo check"
cargo check

green "==> Rebase verified. Inspect with: git log --oneline $UPSTREAM_REMOTE/$UPSTREAM_BRANCH..HEAD"
yellow "Reminder: do NOT push to $UPSTREAM_REMOTE. Add a new remote first."
