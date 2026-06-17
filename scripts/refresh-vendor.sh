#!/usr/bin/env bash
# Pull the latest upstream into one of our vendored subtrees.
#
# Usage: ./scripts/refresh-vendor.sh <name>
# Example: ./scripts/refresh-vendor.sh async-openai
#
# Add new vendored crates by appending to the UPSTREAM / REF maps below.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <vendor-name>" >&2
  echo "" >&2
  echo "known:" >&2
  echo "  async-openai" >&2
  echo "  gbnf-validator" >&2
  exit 1
fi

name="$1"

declare -A UPSTREAM
declare -A REF
# When you switch upstream bases, update both lines here AND vendor/README.md.
UPSTREAM[async-openai]="https://github.com/fastrepl/async-openai"
REF[async-openai]="6404d307f3f706e818ad91544dc82fac5c545aee"

UPSTREAM[gbnf-validator]="https://github.com/fastrepl/gbnf-validator"
REF[gbnf-validator]="main"

upstream="${UPSTREAM[$name]:-}"
ref="${REF[$name]:-}"
if [ -z "$upstream" ]; then
  echo "no upstream registered for '$name'" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

prefix="vendor/$name"
if [ ! -d "$prefix" ]; then
  echo "no such vendored tree: $prefix" >&2
  exit 1
fi

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

if ! git diff-index --quiet HEAD --; then
  yellow "Working tree is dirty. Commit or stash before refreshing."
  git status --short
  exit 1
fi

bold "==> Fetching $upstream $ref"
git fetch "$upstream" "$ref"

bold "==> git subtree pull --prefix=$prefix"
if ! git subtree pull --prefix="$prefix" "$upstream" "$ref" --squash; then
  yellow ""
  yellow "Merge conflicts above. Files under $prefix/ now have conflict markers."
  yellow "Resolve, then: git add $prefix && git commit"
  exit 1
fi

bold "==> cargo check (verify vendored update still compiles)"
cargo check

green "==> $name refreshed cleanly."
yellow "If you bumped to a newer ref permanently, update REF[$name] in this"
yellow "script + the rev column in vendor/README.md."
