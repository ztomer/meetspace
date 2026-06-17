#!/usr/bin/env bash
# Verify local codebase compatibility with GitHub Actions CI strict constraints.
#
# Runs formatting, TypeScript typing, and strict Rust Warnings-as-Errors release audits.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

bold "==> Starting local CI compatibility audit..."

# 1. Formatting Check
bold "==> 1/3 Auditing Code Formatting (dprint)..."
if ! pnpm exec dprint fmt --check; then
  red "Error: Formatting audit failed! Run 'pnpm exec dprint fmt' to fix formatting."
  exit 1
fi
green "✔ Formatting is fully compatible!"

# 2. TypeScript Check
bold "==> 2/3 Auditing TypeScript Types (@meetspace/desktop)..."
if ! pnpm -F @meetspace/desktop typecheck; then
  red "Error: TypeScript type check failed!"
  exit 1
fi
green "✔ TypeScript types are fully compatible!"

# 3. Rust Strict Release Check
bold "==> 3/3 Auditing Rust release warnings-as-errors (--release)..."
if ! RUSTFLAGS="-D warnings" cargo check --workspace --release; then
  red "Error: Rust strict release compiler check failed! Fix warnings/errors shown above."
  exit 1
fi
green "✔ Rust codebase is fully compatible with production packaging!"

green "==> 🎉 Success! Your local environment is 100% compatible with GitHub CI."
