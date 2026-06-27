#!/usr/bin/env bash
set -euo pipefail

# Ensure we are in the repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Check clean status
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory has uncommitted changes. Please commit or stash them first." >&2
  exit 1
fi

# 2. Check current branch is MIT_BACK
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "MIT_BACK" ]; then
  echo "Error: You must be on the MIT_BACK branch to release. Current: $CURRENT_BRANCH" >&2
  exit 1
fi

# Extract version from meetspace.rb
VERSION=$(grep -o 'version "[^"]*"' scripts/brew/meetspace.rb | cut -d'"' -f2)
TAG="v$VERSION"
echo "Starting release workflow for version: $VERSION (tag: $TAG)"

# 3. Push MIT_BACK branch
echo "Pushing MIT_BACK branch to remote meetspace..."
env GITHUB_TOKEN="" git push --force meetspace MIT_BACK

# 4. Handle Tag (re-create if exists)
echo "Re-creating tag $TAG locally and on remote..."
git tag -d "$TAG" 2>/dev/null || true
env GITHUB_TOKEN="" git push meetspace :refs/tags/"$TAG" 2>/dev/null || true
git tag "$TAG"
env GITHUB_TOKEN="" git push meetspace "$TAG"

# 5. Create GitHub Release
echo "Creating GitHub Release $TAG..."
# If release already exists, delete it first to be clean
RELEASE_ID=$(env GITHUB_TOKEN="" gh api repos/ztomer/meetspace/releases/tags/"$TAG" --jq '.id' 2>/dev/null || true)
if [ -n "$RELEASE_ID" ]; then
  echo "Deleting existing release $TAG (ID: $RELEASE_ID)..."
  env GITHUB_TOKEN="" gh api -X DELETE repos/ztomer/meetspace/releases/"$RELEASE_ID" >/dev/null || true
fi

env GITHUB_TOKEN="" gh api repos/ztomer/meetspace/releases \
  -f tag_name="$TAG" \
  -f target_commitish="MIT_BACK" \
  -f name="$TAG" \
  -f body="Release $TAG" >/dev/null

# 6. Wait for GitHub Actions workflow to trigger
echo "Waiting for GitHub Actions 'Build & Release Artifacts' workflow to start..."
RUN_ID=""
for i in {1..30}; do
  RUN_ID=$(env GITHUB_TOKEN="" gh run list --workflow="Build & Release Artifacts" --branch "$TAG" --limit 1 --json databaseId --jq '.[0].databaseId' || true)
  if [ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ]; then
    echo "Workflow run detected! Run ID: $RUN_ID"
    break
  fi
  sleep 4
done

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "Error: GitHub Actions run was not triggered within 2 minutes." >&2
  exit 1
fi

# Watch workflow run
echo "Watching GitHub Actions run $RUN_ID..."
env GITHUB_TOKEN="" gh run watch "$RUN_ID" --exit-status

echo "GitHub Actions build completed successfully!"

# 7. Poll Homebrew tap Cask to verify version update
cask_url="https://raw.githubusercontent.com/ztomer/homebrew-tap/main/Casks/meetspace.rb"
echo "Polling Homebrew tap for version update..."
TAP_UPDATED=false
for i in {1..24}; do
  current_ver=$(curl -fsL "$cask_url" | grep -o 'version "[^"]*"' | cut -d'"' -f2 || true)
  if [ "$current_ver" = "$VERSION" ]; then
    echo "Homebrew tap updated successfully to $VERSION!"
    TAP_UPDATED=true
    break
  fi
  echo "Waiting for Homebrew tap to update (current: $current_ver, expected: $VERSION)... [Attempt $i/24]"
  sleep 10
done

if [ "$TAP_UPDATED" = false ]; then
  echo "Homebrew tap auto-update timed out. Falling back to manual push..."
  
  tmp_dir=$(mktemp -d -t meetspace-tap.XXXXXX)
  echo "Cloning ztomer/homebrew-tap to $tmp_dir..."
  env GITHUB_TOKEN="" gh repo clone ztomer/homebrew-tap "$tmp_dir"
  
  mkdir -p "$tmp_dir/Casks"
  cp scripts/brew/meetspace.rb "$tmp_dir/Casks/meetspace.rb"
  
  cd "$tmp_dir"
  git add Casks/meetspace.rb
  git commit -m "Update meetspace to $VERSION"
  env GITHUB_TOKEN="" git push origin main
  cd -
  rm -rf "$tmp_dir"
  echo "Homebrew tap updated manually successfully!"
fi

echo "Release $TAG complete!"
