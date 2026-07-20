#!/usr/bin/env bash
# Rebase this local-only fork onto the latest upstream stable release tag
# (`desktop_vX.Y.Z`, no `-nightly` suffix), then validate.
#
# Falls back to `origin/main` if --on-main is passed, or if no stable tag
# newer than HEAD's most recent ancestor tag can be found.
#
# We do NOT push from this script. Remotes:
#   origin    -> https://github.com/fastrepl/meetspace.git   (upstream; rebase source)
#   meetspace -> https://github.com/ztomer/meetspace.git   (fork; push target — when approved)
# See docs/FORK_PLAN.md and docs/_REMOVED_AUTH.md for context.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Ensure rerere + generated-file merge driver are active before rebasing.
bash scripts/setup-fork-git.sh >/dev/null

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
    TARGET="$LATEST_TAG"
    TARGET_LABEL="$LATEST_TAG (latest stable)"
  fi
fi

# Check whether HEAD already contains this target's commit.
if git merge-base --is-ancestor "$TARGET" HEAD 2>/dev/null; then
  green "Rebase target $TARGET_LABEL is already in HEAD. No rebase required."
  exit 0
fi

# Copy resolve_conflicts.py to /tmp so it's always available during early rebase commits
cp scripts/resolve_conflicts.py /tmp/resolve_conflicts.py

bold "==> Rebasing onto $TARGET_LABEL"
if ! git rebase "$TARGET"; then
  yellow "Rebase encountered conflicts. Attempting automatic resolution..."
  
  # Keep looping while rebase is in progress
  while [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] || [ -d "$(git rev-parse --git-dir 2>/dev/null)/rebase-merge" ] || [ -d "$(git rev-parse --git-dir 2>/dev/null)/rebase-apply" ]; do
    yellow "Running auto-conflict-resolution script..."
    if python3 /tmp/resolve_conflicts.py; then
      green "All conflicts in this step resolved. Continuing rebase..."
      if ! git -c core.editor=true rebase --continue 2>&1 | tee /tmp/rebase_out; then
        if grep -q "No changes - did you forget to use 'git add'?" /tmp/rebase_out || grep -q "nothing to commit" /tmp/rebase_out; then
          yellow "Commit is empty. Skipping..."
          git rebase --skip
        else
          # It failed because of next commit's conflicts, continue to next loop iteration
          continue
        fi
      fi
    else
      red "Some conflicts could not be resolved automatically."
      yellow "Please resolve the remaining conflicts manually, then run: git rebase --continue"
      exit 1
    fi
  done
  green "Rebase completed and resolved successfully!"
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
  ".github/scripts"
  ".github/reports"
  "scripts/s3"
  # Release-link fix: upstream's libsql-backed legacy DB carriers statically
  # link a second copy of sqlite and collide with sqlx's libsqlite3-sys at
  # release link time (duplicate symbol '_sqlite3_*'). The importer was
  # repointed at rusqlite (db-parser), so these libsql carriers must stay
  # deleted on every rebase.
  "legacy/db-core"
  "legacy/db-user"
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

bold "==> Automatically rebranding legacy names and imports to Meetspace"
python3 scripts/rebrand_sweep.py

bold "==> Regenerating i18n catalogs (extract from rebranded source, then compile)"
# `i18n:extract` runs `lingui extract --clean`. The --clean pass is REQUIRED:
# the committed .po files still carry stale upstream "Anarlog" msgids, and
# `lingui compile` compiles OBSOLETE (#~) entries too, so a bare compile would
# regenerate an `en` catalog containing "Anarlog" strings. --clean drops the
# obsolete entries first. (An earlier incident DID drop ~125 live messages on a
# --clean pass, but that was a stale-state extraction failure; the current tree
# extracts cleanly and `i18n:check` keeps the committed catalogs in sync with
# source. The guard below catches any future message-drop regression.)
if pnpm -F desktop i18n:extract && pnpm -F desktop i18n:compile; then
  en_msgs=$(grep -c '^msgid ' apps/desktop/src/i18n/locales/en/messages.po 2>/dev/null || echo 0)
  EN_TS="apps/desktop/src/i18n/locales/en/messages.ts"
  missing=""
  for key in nbfdhU VrNltZ iDNBZe LMUw1U Gzw2pq 9cDpsw; do
    grep -q "$key" "$EN_TS" || missing="$missing $key"
  done
  if [ "$en_msgs" -lt 380 ] || [ -n "$missing" ]; then
    yellow "  WARNING: en catalog may be broken (msgs=$en_msgs, missing keys:$missing)."
    yellow "  Inspect apps/desktop/src/i18n/locales/en and the source before releasing."
  else
    green "  i18n catalogs regenerated ($en_msgs en messages)."
  fi
else
  yellow "i18n regeneration failed; run 'pnpm -F desktop i18n:extract && pnpm -F desktop i18n:compile' manually before release"
fi

bold "==> Formatting codebase with dprint"
pnpm exec dprint fmt

# The desktop's main.tsx imports @meetspace/ui/globals.css, which resolves to
# packages/ui/dist/globals.css — produced by tailwindcss compile in @meetspace/ui's
# build script. The dist is git-ignored, so rebuild before typecheck/vite touch it.
bold "==> pnpm -F @meetspace/ui build (rebuild Tailwind globals.css + token CSS vars)"
pnpm -F @meetspace/ui build

bold "==> pnpm -F desktop typecheck"
pnpm -F desktop typecheck

bold "==> cargo check"
cargo check

bold "==> Fork hygiene guard (conflict markers + un-rebranded names)"
# scripts/check-clean.py scans for leftover git conflict markers and any
# hyprnote/anarlog branding the rebrand sweep should have renamed, while exempting
# S3 bucket hostnames (hyprnote.s3.*) which are external infra, not product branding.
python3 scripts/check-clean.py

if command -v cargo-sweep &> /dev/null; then
  bold "==> Pruning build artifacts older than 30 days"
  cargo sweep --time 30
fi

green "==> Rebase verified against $TARGET."
yellow "Inspect with: git log --oneline $TARGET..HEAD"
yellow "Reminder: do NOT push to $UPSTREAM_REMOTE. Push to 'meetspace' once approved."
