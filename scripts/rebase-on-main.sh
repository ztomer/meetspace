#!/usr/bin/env bash
# Rebase this local-only fork onto the latest upstream stable release tag
# (`desktop_vX.Y.Z`, no `-nightly` suffix), then validate.
#
# Falls back to `origin/main` if --on-main is passed, or if no stable tag
# newer than HEAD's most recent ancestor tag can be found.
#
# We do NOT push from this script. Remotes:
#   origin    -> https://github.com/fastrepl/anarlog.git   (upstream; rebase source)
#   meetspace -> https://github.com/ztomer/meetspace.git   (fork; push target — when approved)
# See docs/FORK_PLAN.md and docs/_REMOVED_AUTH.md for context.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-origin}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
STABLE_TAG_PATTERN='^desktop_v[0-9]+\.[0-9]+\.[0-9]+$'

USE_MAIN=0
for arg in "$@"; do
  case "$arg" in
    --on-main) USE_MAIN=1 ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--on-main]

  (default) Rebase onto the latest upstream stable release tag
            (desktop_vX.Y.Z). Skips if HEAD already includes it.
  --on-main Rebase onto $UPSTREAM_REMOTE/$UPSTREAM_BRANCH instead.

Environment:
  UPSTREAM_REMOTE  remote to fetch from (default: origin)
  UPSTREAM_BRANCH  main branch name (default: main)
EOF
      exit 0
      ;;
  esac
done

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

bold "==> Fetching $UPSTREAM_REMOTE (branches + tags)"
git fetch --tags --prune "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

# Pick the rebase target.
TARGET=""
TARGET_LABEL=""

if [ "$USE_MAIN" = "1" ]; then
  TARGET="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
  TARGET_LABEL="$TARGET (forced via --on-main)"
else
  # Most recent stable tag by creation date.
  LATEST_TAG=$(git tag --sort=-creatordate | grep -E "$STABLE_TAG_PATTERN" | head -n 1 || true)

  if [ -z "$LATEST_TAG" ]; then
    yellow "No stable desktop_vX.Y.Z tag found; falling back to $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
    TARGET="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
    TARGET_LABEL="$TARGET (no stable tag)"
  else
    # Check whether HEAD already contains this tag's commit.
    if git merge-base --is-ancestor "$LATEST_TAG" HEAD 2>/dev/null; then
      green "Latest stable tag $LATEST_TAG is already in HEAD. Nothing to do."
      yellow "Pass --on-main to rebase onto $UPSTREAM_REMOTE/$UPSTREAM_BRANCH anyway."
      exit 0
    fi
    TARGET="$LATEST_TAG"
    TARGET_LABEL="$LATEST_TAG (latest stable)"
  fi
fi

bold "==> Rebasing onto $TARGET_LABEL"
if ! git rebase "$TARGET"; then
  red "Rebase has conflicts."
  yellow "Check docs/_REMOVED_AUTH.md — most conflicts are upstream resurrecting files we deleted."
  yellow "Resolve them, then run: git rebase --continue"
  exit 1
fi

bold "==> Re-removing files in docs/_REMOVED_AUTH.md that upstream may have reintroduced"

# Directories that should stay deleted in this fork.
REMOVED_DIRS=(
  # Phase 1 — auth/billing/cloud backend.
  "apps/api"
  "apps/stripe"
  "apps/web"
  "supabase"
  "packages/supabase"
  "packages/pricing"
  "apps/desktop/src/billing"
  "apps/desktop/src/onboarding/account"
  # Phase 7 rebrand pass — upstream's CI + release pipeline.
  ".github/workflows"
  ".github/actions"
  ".github/scripts"
  ".github/reports"
  "scripts/s3"
)

# Individual files that should stay deleted.
REMOVED_FILES=(
  # Phase 1.
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
  # Phase 4g — dead-code integrations panel never mounted.
  "apps/desktop/src/settings/integrations.tsx"
  "apps/desktop/src/settings/shared.tsx"
  # Phase 7 rebrand pass.
  "scripts/download_releases.sh"
  ".github/AGENTS.md"
)

# File-name globs that should stay deleted (one entry per pattern).
# Globs are evaluated under `shopt -s nullglob` so missing matches are OK.
REMOVED_GLOBS=(
  # Phase 7 — historical upstream changelogs (30 of them, 1.0.0..1.0.30).
  "packages/changelog/content/1.*.md"
  "packages/changelog/content/0.0.*.md"
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
shopt -s nullglob
for pattern in "${REMOVED_GLOBS[@]}"; do
  for match in $pattern; do
    yellow "  re-removing (glob): $match"
    git rm "$match" >/dev/null
    resurrected=1
  done
done
shopt -u nullglob

if [ "$resurrected" = "1" ]; then
  yellow "Some deletions were re-applied. Review them, then commit:"
  yellow "  git commit -m 'chore(fork): re-remove upstream files after rebase on $TARGET'"
fi

bold "==> pnpm install"
pnpm install --frozen-lockfile=false

# The desktop's main.tsx imports @meetspace/ui/globals.css, which resolves to
# packages/ui/dist/globals.css — produced by tailwindcss compile in @meetspace/ui's
# build script. The dist is git-ignored, so rebuild before typecheck/vite touch it.
bold "==> pnpm -F @meetspace/ui build (rebuild Tailwind globals.css + token CSS vars)"
pnpm -F @meetspace/ui build

bold "==> pnpm -F desktop typecheck"
pnpm -F desktop typecheck

bold "==> cargo check"
cargo check

green "==> Rebase verified against $TARGET."
yellow "Inspect with: git log --oneline $TARGET..HEAD"
yellow "Reminder: do NOT push to $UPSTREAM_REMOTE. Push to 'meetspace' once approved."
