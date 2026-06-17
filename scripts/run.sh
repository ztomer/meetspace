#!/usr/bin/env bash
# Launch the Meetspace desktop app in dev mode.
#
# This wraps `pnpm -F @meetspace/desktop tauri:dev`. It:
#   - Starts the Vite dev server on the configured port.
#   - Compiles the Rust side and launches the Tauri window.
#   - Hot-reloads JS/TS but not Rust (--no-watch is set upstream).
#
# Usage: ./scripts/run.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -d node_modules ]; then
  echo "==> First run — installing dependencies"
  pnpm install
fi

# Vite needs @meetspace/ui's compiled globals.css to resolve the import in
# main.tsx. The file is in .gitignore'd dist/, so build it if missing.
if [ ! -f packages/ui/dist/globals.css ]; then
  echo "==> Prebuilding @meetspace/ui (Tailwind globals.css)"
  pnpm -F @meetspace/ui build
fi

exec pnpm -F @meetspace/desktop tauri:dev
