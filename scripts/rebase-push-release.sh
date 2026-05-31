#!/usr/bin/env bash
# Automated script to rebase, push the updated branch to Meetspace, and package a release DMG.
#
# Usage:
#   ./scripts/rebase-push-release.sh [branch_name] [--no-rebase] [--no-push]
#
# Defaults:
#   branch_name: current Git branch
#   --no-rebase: skip the rebase step (useful if you already rebased manually)
#   --no-push:   skip pushing to the meetspace remote

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Helper coloring functions
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRANCH_NAME="${1:-$CURRENT_BRANCH}"
SKIP_REBASE=0
SKIP_PUSH=0
USE_STABLE=0
CLEAN_CACHE=0

# Shift first argument if it's a branch name (i.e. does not start with -)
if [[ $# -gt 0 && ! "$1" =~ ^- ]]; then
  shift
fi

for arg in "$@"; do
  case "$arg" in
    --no-rebase) SKIP_REBASE=1 ;;
    --no-push)   SKIP_PUSH=1 ;;
    --stable|stable) USE_STABLE=1 ;;
    --clean)     CLEAN_CACHE=1 ;;
    -h|--help)
      cat <<EOF
Usage: $0 [branch_name] [--no-rebase] [--no-push] [--stable] [--clean]

  [branch_name]  The branch to push and build (default: current branch '$CURRENT_BRANCH')
  --no-rebase    Skip rebasing onto the latest upstream stable release tag
  --no-push      Skip force-pushing to the 'meetspace' remote on GitHub
  --stable       Build the production stable release (Meetspace.dmg) instead of Meetspace Dev
  --clean        Wipe stale Tauri and cargo build caches before packaging
EOF
      exit 0
      ;;
  esac
done

if [ "$SKIP_REBASE" = "0" ]; then
  bold "==> Starting Rebase onto Upstream Stable Release"
  if ! ./scripts/rebase-on-main.sh; then
    red "Rebase failed or conflicts encountered."
    yellow "Please resolve conflicts, finish the rebase, and then re-run this script with:"
    yellow "  ./scripts/rebase-push-release.sh $BRANCH_NAME --no-rebase"
    exit 1
  fi
  green "==> Rebase completed and verified successfully!"
else
  yellow "==> Skipping rebase step as requested (--no-rebase)."
fi

if [ "$SKIP_PUSH" = "0" ]; then
  bold "==> Pushing updated branch '$BRANCH_NAME' to 'meetspace' remote"
  
  if ! git remote | grep -q "^meetspace$"; then
    red "Error: 'meetspace' remote is not configured."
    yellow "Verify with: git remote -v"
    exit 1
  fi
  
  git push meetspace "$BRANCH_NAME" --force
  green "==> Branch '$BRANCH_NAME' pushed successfully to 'meetspace' GitHub!"
else
  yellow "==> Skipping push to meetspace remote (--no-push)."
fi

if [ "$CLEAN_CACHE" = "1" ]; then
  bold "==> Wiping stale Tauri and cargo build caches"
  rm -rf apps/desktop/src-tauri/target
  cargo clean
else
  yellow "==> Retaining build caches for fast incremental compilation (pass --clean to wipe)"
fi

PACKAGE_ARGS=("dmg")
if [ "$USE_STABLE" = "1" ]; then
  PACKAGE_ARGS+=("stable")
fi

bold "==> Building macOS release DMG installer"
if ! ./scripts/package.sh "${PACKAGE_ARGS[@]}"; then
  red "Error: DMG packaging failed!"
  exit 1
fi

green "==> All steps completed successfully!"
bold "Artifact generated in:"
find target/release/bundle apps/desktop/src-tauri/target/release/bundle \
  -maxdepth 3 -type f -name '*.dmg' 2>/dev/null || true
