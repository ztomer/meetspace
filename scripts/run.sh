#!/usr/bin/env bash
# Launch the Anarlog desktop app in dev mode.
#
# This wraps `pnpm -F @hypr/desktop tauri:dev`. It:
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

exec pnpm -F @hypr/desktop tauri:dev
