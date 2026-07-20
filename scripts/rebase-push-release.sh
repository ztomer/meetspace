#!/usr/bin/env bash
# Automated script to rebase, push the updated branch to Meetspace, and either
# package a local DMG or cut a full GitHub release (which auto-updates Homebrew).
#
# Usage:
#   ./scripts/rebase-push-release.sh [branch_name] [--no-rebase] [--no-push]
#   ./scripts/rebase-push-release.sh --release [--version X.Y.Z-meetN]
#
# Defaults:
#   branch_name: current Git branch
#   --no-rebase: skip the rebase step (useful if you already rebased manually)
#   --no-push:   skip pushing to the meetspace remote
#   --release:   cut a GitHub release instead of building a local DMG. This
#                creates the tag + release, which triggers the
#                "Build & Release Artifacts" workflow. That workflow builds the
#                stable DMG AND auto-updates the ztomer/homebrew-tap cask from
#                scripts/brew/meetspace.rb (via scripts/push_release.sh).
#   --version:   bump the release version across Cargo.toml, Cargo.lock, and
#                scripts/brew/meetspace.rb before releasing. Accepts hyphen or
#                underscore meet form (1.1.16-meet1 == 1.1.16_meet1). If omitted
#                with --release, the version is derived from the latest upstream
#                stable tag in HEAD.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Helper coloring functions
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRANCH_NAME="$CURRENT_BRANCH"
SKIP_REBASE=0
SKIP_PUSH=0
USE_STABLE=0
CLEAN_CACHE=0
DO_RELEASE=0
DO_LOCAL=0
BUMP_VERSION=""

# Consume the first argument as the branch name only if it is not a flag.
if [[ $# -gt 0 && ! "$1" =~ ^- ]]; then
  BRANCH_NAME="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-rebase) SKIP_REBASE=1 ;;
    --no-push)   SKIP_PUSH=1 ;;
    --stable|stable) USE_STABLE=1 ;;
    --clean)     CLEAN_CACHE=1 ;;
    --release)   DO_RELEASE=1 ;;
    --local)     DO_LOCAL=1 ;;
    --version)   BUMP_VERSION="${2:-}"; shift ;;
    --version=*) BUMP_VERSION="${1#*=}" ;;
    -h|--help)
      cat <<EOF
Usage: $0 [branch_name] [--no-rebase] [--no-push] [--stable] [--clean]
       $0 [--release] [--version X.Y.Z-meetN]

  [branch_name]      The branch to push and build (default: current branch '$CURRENT_BRANCH')
  --no-rebase        Skip rebasing onto the latest upstream stable release tag
  --no-push          Skip force-pushing to the 'meetspace' remote on GitHub
  --stable           Build the production stable release (Meetspace.dmg) instead of Meetspace Dev
  --clean            Wipe stale Tauri and cargo build caches before packaging
  --release          Cut a GitHub release (tag + release) instead of a local DMG.
                     Delegates to push_release.sh, which triggers CI to build the
                     stable DMG and auto-update Homebrew.
  --local            Local-first release: build the stable DMG locally (no CI),
                     then create the tag + GitHub release and upload the DMG
                     asset. Use this fork's path — CI is disabled by design.
  --version <ver>    Bump the release version (e.g. 1.1.16-meet1) before releasing.
EOF
      exit 0
      ;;
    *)
      red "Unknown argument: $1"
      exit 1
      ;;
  esac
  shift
done

# Derive a meet version (X.Y.Z-meetN) from the latest upstream stable tag in HEAD.
derive_version() {
  local latest_tag base cargo_version cur_base cur_n
  latest_tag=$(git tag --sort=-creatordate \
    | grep -E '^desktop_v[0-9]+\.[0-9]+\.[0-9]+$' \
    | while read -r t; do
        if git merge-base --is-ancestor "$t" HEAD 2>/dev/null; then echo "$t"; break; fi
      done)
  if [ -z "$latest_tag" ]; then
    red "Could not find an upstream stable tag in HEAD to derive a version." >&2
    return 1
  fi
  base="${latest_tag#desktop_v}"
  cargo_version=$(grep -m1 '^version = ' "apps/desktop/src-tauri/Cargo.toml" | cut -d'"' -f2)
  cur_base="${cargo_version%-meet*}"
  cur_n="${cargo_version#*-meet}"
  if [ "$cur_base" = "$base" ] && [[ "$cur_n" =~ ^[0-9]+$ ]]; then
    echo "${base}-meet$((cur_n + 1))"
  else
    echo "${base}-meet1"
  fi
}

# Bump the version everywhere the local release flow reads it.
#   $1 = meet version in hyphen or underscore form (1.1.16-meet1 / 1.1.16_meet1)
bump_version() {
  local raw="$1"
  local cargo_ver="${raw//_/-}"   # 1.1.16-meet1  (Cargo/DMG semver)
  local cask_ver="${cargo_ver//-/_}"  # 1.1.16_meet1  (tag/cask)

  bold "==> Bumping version to $cargo_ver (cask: $cask_ver)"

  perl -0pi -e "s/^version = \"[^\"]*\"/version = \"$cargo_ver\"/m" \
    apps/desktop/src-tauri/Cargo.toml

  perl -0pi -e "s/(name = \"desktop\"\nversion = )\"[^\"]*\"/\$1\"$cargo_ver\"/" \
    Cargo.lock

  perl -pi -e "s/version \"[^\"]*\"/version \"$cask_ver\"/" \
    scripts/brew/meetspace.rb

  if ! git diff --quiet -- apps/desktop/src-tauri/Cargo.toml Cargo.lock scripts/brew/meetspace.rb; then
    git add apps/desktop/src-tauri/Cargo.toml Cargo.lock scripts/brew/meetspace.rb
    git commit -m "chore(release): bump version to $cask_ver"
    green "==> Version bump committed."
  else
    yellow "==> Version already at $cargo_ver; nothing to bump."
  fi
}

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

# --release delegates the full publish (push + tag + GitHub release + CI-driven
# stable DMG build + Homebrew tap auto-update) to push_release.sh.
if [ "$DO_RELEASE" = "1" ]; then
  if [ -n "$BUMP_VERSION" ]; then
    bump_version "$BUMP_VERSION"
  fi

  bold "==> Cutting GitHub release (triggers CI stable DMG + Homebrew tap update)"
  RELEASE_VER=$(grep -o 'version "[^"]*"' scripts/brew/meetspace.rb | cut -d'"' -f2)
  green "Release version: $RELEASE_VER (from scripts/brew/meetspace.rb)"
  exec ./scripts/push_release.sh
fi

# --local: local-first release. CI is disabled in this fork, so we build the
# stable DMG on this machine and upload it to the GitHub release directly.
if [ "$DO_LOCAL" = "1" ]; then
  if [ -n "$BUMP_VERSION" ]; then
    bump_version "$BUMP_VERSION"
  fi

  RELEASE_VER=$(grep -o 'version "[^"]*"' scripts/brew/meetspace.rb | cut -d'"' -f2)
  TAG="v$RELEASE_VER"
  green "==> Local release: $RELEASE_VER (tag: $TAG)"

  if [ "$SKIP_PUSH" = "0" ]; then
    bold "==> Pushing branch to meetspace remote"
    git push meetspace "$BRANCH_NAME" --force
  fi

  bold "==> Building stable DMG locally"
  if ! ./scripts/package.sh stable dmg; then
    red "Error: local DMG build failed."
    exit 1
  fi

  DMG=$(find target/release/bundle apps/desktop/src-tauri/target/release/bundle \
    -maxdepth 3 -type f -name '*.dmg' 2>/dev/null | head -1)
  if [ -z "$DMG" ]; then
    red "Error: no DMG artifact found after build."
    exit 1
  fi
  green "==> DMG built: $DMG"

  bold "==> Creating tag $TAG"
  git tag -d "$TAG" 2>/dev/null || true
  env GITHUB_TOKEN="" git push meetspace ":refs/tags/$TAG" 2>/dev/null || true
  git tag "$TAG"
  env GITHUB_TOKEN="" git push meetspace "$TAG"

  bold "==> Creating/updating GitHub release $TAG"
  env GITHUB_TOKEN="" gh release delete "$TAG" --yes 2>/dev/null || true
  env GITHUB_TOKEN="" gh release create "$TAG" \
    --title "$TAG" \
    --target "$BRANCH_NAME" \
    --notes "Release $TAG" \
    "$DMG"

  green "==> Local release $TAG complete (DMG uploaded)."
  exit 0
fi

if [ "$SKIP_PUSH" = "0" ]; then
  if ! git remote | grep -q "^meetspace$"; then
    red "Error: 'meetspace' remote is not configured."
    yellow "Verify with: git remote -v"
    exit 1
  fi

  if [ "$BRANCH_NAME" = "MIT_BACK" ]; then
    bold "==> Pushing local branch 'MIT_BACK' as 'main' to 'meetspace' remote"
    git push meetspace MIT_BACK:main --force
    green "==> Branch 'MIT_BACK' pushed successfully as 'main' to 'meetspace' GitHub!"
  else
    bold "==> Pushing updated branch '$BRANCH_NAME' to 'meetspace' remote"
    git push meetspace "$BRANCH_NAME" --force
    green "==> Branch '$BRANCH_NAME' pushed successfully to 'meetspace' GitHub!"
  fi
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

if command -v cargo-sweep &> /dev/null; then
  bold "==> Pruning build artifacts older than 30 days"
  cargo sweep --time 30
fi
