#!/usr/bin/env bash
# Produce a distributable Anarlog desktop build (.dmg / .app / .exe / .deb).
#
# Wraps `pnpm -F @hypr/desktop tauri:build`. Outputs land in:
#   target/release/bundle/    (per-platform installers)
#   apps/desktop/src-tauri/target/release/bundle/
#
# Signing is NOT configured for this fork; binaries will be unsigned. You'll
# get the usual macOS Gatekeeper warning unless you sign + notarize them
# yourself (see https://v2.tauri.app/distribute/sign/macos/).
#
# Usage:
#   ./scripts/package.sh             # build all targets for the host platform
#   ./scripts/package.sh dmg         # macOS .dmg only
#   ./scripts/package.sh app         # macOS .app bundle only
#   ./scripts/package.sh deb         # Linux .deb
#   ./scripts/package.sh nsis msi    # Windows installers

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

if [ ! -d node_modules ]; then
  bold "==> First run — installing dependencies"
  pnpm install
fi

bold "==> Prebuild @hypr/ui (Tailwind globals.css)"
pnpm -F @hypr/ui build

bold "==> Tauri build"
if [ "$#" -gt 0 ]; then
  pnpm -F @hypr/desktop tauri build --bundles "$@"
else
  pnpm -F @hypr/desktop tauri build
fi

green "==> Done. Artifacts:"
find target/release/bundle apps/desktop/src-tauri/target/release/bundle \
  -maxdepth 3 -type f \
  \( -name '*.dmg' -o -name '*.app' -o -name '*.exe' -o -name '*.msi' -o -name '*.deb' -o -name '*.AppImage' \) \
  2>/dev/null || true
