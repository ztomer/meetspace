#!/usr/bin/env bash
# Verify the codebase builds end-to-end without producing an installer.
#
# Runs:
#   - pnpm install
#   - pnpm -r typecheck   (every workspace TS package)
#   - cargo check         (every Rust crate)
#   - pnpm -F @hypr/desktop build  (Vite production bundle, no Tauri pkg)
#
# Use scripts/package.sh when you want a distributable .dmg / .app / .exe.
# Use scripts/run.sh when you want to launch in dev mode.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }

bold "==> pnpm install"
pnpm install

bold "==> pnpm -r typecheck"
pnpm -r typecheck

bold "==> cargo check"
cargo check

bold "==> pnpm -F @hypr/desktop build (Vite bundle)"
pnpm -F @hypr/desktop build

bold "==> Build verified. Run scripts/package.sh to produce installers."
