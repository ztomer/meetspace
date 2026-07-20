#!/usr/bin/env bash
# Local-first release pipeline — NO GitHub Actions required.
#
# This fork has all workflows set to `on: []` by design (CI is disabled), so
# the CI-driven `push_release.sh` / `rebase-push-release.sh --release` paths
# hang waiting on a workflow that never runs. This script does the whole
# release locally instead:
#
#   1. sanity-check (clean tree, MIT_BACK branch)
#   2. push branch + (re)create the git tag
#   3. build the stable DMG locally (package.sh stable dmg)
#   4. create the GitHub release + upload the DMG via `gh api`
#      (uses the REST API directly to avoid `gh release`'s `workflow`-scope
#      requirement, which the fork's token lacks)
#   5. update the ztomer/homebrew-tap Cask to the new version and push it
#   6. verify the release asset + live tap version resolve
#
# Usage:
#   ./scripts/local-release.sh                 # release current version in scripts/brew/meetspace.rb
#   ./scripts/local-release.sh --version 1.3.1-meet2   # bump, then release
#   ./scripts/local-release.sh --no-dmg        # skip the (slow) DMG build; reuse an existing artifact
#   ./scripts/local-release.sh --no-tap        # skip the Homebrew tap update
#   ./scripts/local-release.sh --no-push       # do everything except push/remote writes
#
# Idempotent: re-running for the same version recreates the tag + release and
# re-uploads the asset (clobber).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

BUMP_VERSION=""
SKIP_DMG=0
SKIP_TAP=0
SKIP_PUSH=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)   BUMP_VERSION="${2:-}"; shift ;;
    --version=*) BUMP_VERSION="${1#*=}" ;;
    --no-dmg)    SKIP_DMG=1 ;;
    --no-tap)    SKIP_TAP=1 ;;
    --no-push)   SKIP_PUSH=1 ;;
    -h|--help)
      sed -n '3,40p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) red "Unknown argument: $1"; exit 1 ;;
  esac
  shift
done

# --- 1. sanity --------------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  red "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "MIT_BACK" ]; then
  red "Error: must be on MIT_BACK branch (current: $CURRENT_BRANCH)."
  exit 1
fi

# --- optional version bump (reuses rebase-push-release.sh helper) ----------
if [ -n "$BUMP_VERSION" ]; then
  bold "==> Bumping version to $BUMP_VERSION"
  # Source only the bump_version function from the sibling script.
  FUNC_FILE="$(mktemp -t bumpfn.XXXXXX)"
  sed -n '/^bump_version()/,/^}/p' scripts/rebase-push-release.sh > "$FUNC_FILE"
  # shellcheck disable=SC1090
  source "$FUNC_FILE"
  bump_version "$BUMP_VERSION"
  rm -f "$FUNC_FILE"
  # bump_version commits; refresh tree check downstream by re-reading version.
fi

# --- 2. derive version + tag ----------------------------------------------
VERSION=$(grep -o 'version "[^"]*"' scripts/brew/meetspace.rb | cut -d'"' -f2)
TAG="v$VERSION"
CASK_VERSION="${VERSION//-/_}"   # 1.3.1-meet2 -> 1.3.1_meet2
green "==> Releasing $VERSION (tag: $TAG)"

# --- 3. push branch + tag --------------------------------------------------
if [ "$SKIP_PUSH" = "0" ]; then
  bold "==> Pushing branch + tag to meetspace"
  git push meetspace "$CURRENT_BRANCH" --force
  git tag -d "$TAG" 2>/dev/null || true
  git push meetspace ":refs/tags/$TAG" 2>/dev/null || true
  git tag "$TAG"
  git push meetspace "$TAG"
else
  yellow "==> --no-push: skipping branch/tag push."
fi

# --- 3.5 i18n guard: never ship a corrupted (Anarlog / incomplete) catalog --
# The build compiles catalogs from the committed en/messages.ts. A stray
# `i18n:compile` run regenerates that file from the stale upstream .po, which
# still carries Anarlog msgids (even marked obsolete, lingui compile includes
# them). That produced a shipped DMG whose English UI showed raw hash keys and
# "Anarlog" strings. Abort here if the committed catalog is not clean.
bold "==> Verifying i18n catalog branding + completeness"
EN_TS="apps/desktop/src/i18n/locales/en/messages.ts"
if grep -q "Anarlog" "$EN_TS"; then
  red "Error: en catalog still contains 'Anarlog' (stale upstream .po compiled in)."
  red "Fix: pnpm -F @meetspace/desktop i18n:extract && pnpm -F @meetspace/desktop i18n:compile, then commit."
  exit 1
fi
for key in nbfdhU VrNltZ iDNBZe LMUw1U Gzw2pq 9cDpsw; do
  if ! grep -q "$key" "$EN_TS"; then
    red "Error: en catalog missing fork key '$key' (i18n drift -> raw hash strings in UI)."
    red "Fix: regenerate i18n from source and commit, then re-run."
    exit 1
  fi
done
green "==> i18n catalog clean (Meetspace-branded, complete)."

# --- 4. build DMG ----------------------------------------------------------
if [ "$SKIP_DMG" = "0" ]; then
  bold "==> Building stable DMG locally"
  if ! ./scripts/package.sh stable dmg; then
    red "Error: DMG build failed."
    exit 1
  fi
else
  yellow "==> --no-dmg: skipping DMG build."
fi

DMG=""
if [ "$SKIP_DMG" = "0" ]; then
  # Tauri names the bundle from its own (hyphen) version, which differs from the
  # cask (underscore) version, so glob rather than reconstructing the exact name.
  DMG=$(find target/release/bundle apps/desktop/src-tauri/target/release/bundle \
    -maxdepth 4 -type f -name "Meetspace_*_aarch64.dmg" 2>/dev/null | head -1)
  if [ -z "$DMG" ]; then
    red "Error: Meetspace DMG not found after build."
    exit 1
  fi
  DMG_NAME=$(basename "$DMG")
  green "==> DMG ready: $DMG ($(du -h "$DMG" | cut -f1))"
fi

# --- 5. create GitHub release + upload via gh api --------------------------
# `gh release create` requires the `workflow` OAuth scope, which this fork's
# token lacks; the REST API does not. Create via `gh api`, upload the asset by
# POSTing to the release's upload_url.
if [ "$SKIP_PUSH" = "0" ]; then
  bold "==> Creating GitHub release $TAG (via REST API)"

  # Delete any pre-existing release for this tag so re-runs are clean.
  OLD_RELEASE_ID=$(gh api "repos/ztomer/meetspace/releases/tags/$TAG" --jq '.id' 2>/dev/null || true)
  if [[ "$OLD_RELEASE_ID" =~ ^[0-9]+$ ]]; then
    yellow "  deleting existing release (id $OLD_RELEASE_ID)"
    gh api -X DELETE "repos/ztomer/meetspace/releases/$OLD_RELEASE_ID" >/dev/null 2>&1 || true
  fi

  RELEASE_JSON=$(gh api repos/ztomer/meetspace/releases \
    -f tag_name="$TAG" \
    -f target_commitish="$CURRENT_BRANCH" \
    -f name="$TAG" \
    -f body="Release $TAG" 2>&1) || { red "Error: failed to create release."; exit 1; }

  UPLOAD_URL=$(printf '%s' "$RELEASE_JSON" | grep -o '"upload_url":"[^"]*"' | sed 's/"upload_url":"//; s/{.*//')
  if [ -z "$UPLOAD_URL" ]; then
    red "Error: could not parse upload_url from release response."
    exit 1
  fi

  bold "==> Uploading DMG asset"
  if [ "$SKIP_DMG" = "0" ] && [ -n "$DMG" ]; then
    gh api --method POST "${UPLOAD_URL}?name=${DMG_NAME}&label=${DMG_NAME}" \
      -H "Content-Type: application/octet-stream" \
      --input "$DMG" >/dev/null 2>&1 || { red "Error: asset upload failed."; exit 1; }
    green "==> Release + asset uploaded."
  else
    yellow "==> --no-dmg: created release without a DMG asset."
  fi
else
  yellow "==> --no-push: skipping GitHub release creation."
fi

# --- 6. update Homebrew tap ------------------------------------------------
if [ "$SKIP_TAP" = "0" ]; then
  bold "==> Updating Homebrew tap (ztomer/homebrew-tap)"
  TMP_TAP=$(mktemp -d -t meetspace-tap.XXXXXX)
  if ! git clone --depth 1 https://github.com/ztomer/homebrew-tap.git "$TMP_TAP" 2>/dev/null; then
    red "Error: could not clone ztomer/homebrew-tap (check git credentials)."
    rm -rf "$TMP_TAP"
    exit 1
  fi

  mkdir -p "$TMP_TAP/Casks"
  cp scripts/brew/meetspace.rb "$TMP_TAP/Casks/meetspace.rb"

  CURRENT_TAP_VER=$(grep -o 'version "[^"]*"' "$TMP_TAP/Casks/meetspace.rb" | cut -d'"' -f2 || true)
  if [ "$CURRENT_TAP_VER" = "$VERSION" ]; then
    yellow "  tap already at $VERSION; nothing to commit."
  else
    cd "$TMP_TAP"
    git add Casks/meetspace.rb
    git commit -m "Update meetspace to $VERSION" >/dev/null
    if [ "$SKIP_PUSH" = "0" ]; then
      git push origin main
    else
      yellow "  --no-push: tap commit created locally, not pushed."
    fi
    cd "$REPO_ROOT"
  fi
  rm -rf "$TMP_TAP"
  green "==> Homebrew tap updated to $VERSION."
else
  yellow "==> --no-tap: skipping Homebrew tap update."
fi

# --- 7. verify -------------------------------------------------------------
bold "==> Verifying release"
if [ "$SKIP_PUSH" = "0" ]; then
  API_VER=$(gh api "repos/ztomer/meetspace/releases/tags/$TAG" --jq '.assets[].name' 2>/dev/null || true)
  if [ "$SKIP_DMG" = "0" ]; then
    if printf '%s' "$API_VER" | grep -q "$DMG_NAME"; then
      green "  release asset present: $DMG_NAME"
    else
      red "  release asset missing from $TAG!"
    fi
  else
    yellow "  --no-dmg: skipped release-asset check."
  fi

  TAP_VER=$(curl -fsL "https://raw.githubusercontent.com/ztomer/homebrew-tap/main/Casks/meetspace.rb" \
    | grep -o 'version "[^"]*"' | cut -d'"' -f2 || true)
  if [ "$TAP_VER" = "$VERSION" ]; then
    green "  homebrew tap cask at $TAP_VER"
  else
    yellow "  homebrew tap cask still at '${TAP_VER:-unknown}' (may need a moment to propagate)"
  fi

  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -L \
    "https://github.com/ztomer/meetspace/releases/download/$TAG/$DMG_NAME" || true)
  if [ "$HTTP" = "200" ]; then
    green "  DMG download URL returns HTTP 200"
  else
    yellow "  DMG download URL returned HTTP $HTTP"
  fi
fi

green "==> Release $TAG complete."
