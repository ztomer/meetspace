#!/usr/bin/env bash
# Commit gate: launch the REAL Meetspace app and confirm it boots without a
# startup panic before allowing a commit that touches app code.
#
# Skips when no app-affecting files are staged (pure docs / scripts / markdown
# changes don't need a 10-minute rebuild). Runs scripts/smoke-launch.sh (which
# builds + launches the actual Tauri backend) otherwise.
#
# Exit semantics from smoke-launch.sh:
#   0 PASS        -> commit allowed
#   1 FAIL (panic)-> commit blocked
#   2 INCONCLUSIVE-> soft pass (warn): no display / cold build too slow. Blocking
#                   on a headless box would break every commit, so we warn only.
#   3 ENV         -> build/dev-server failure: blocked (this is a real breakage).
#
# Bypass: `git commit --no-verify` (git-native) or `SKIP_SMOKE=1` for fast
# iterative commits. A bypass prints a loud warning and is NOT a substitute for
# running the smoke test before a release.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "[ smoke ] SKIP_SMOKE=1 set — skipping running-app smoke gate."
  echo "[ smoke ] Remember to run 'pnpm smoke' before releasing."
  exit 0
fi

# Files that, if staged, warrant a real-app launch (rebuild + boot check).
APP_PATHS=(
  "apps/desktop/src/"
  "apps/desktop/src-tauri/"
  "crates/"
  "plugins/"
)

# Detect staged changes touching app code. `git diff --cached --name-only`
# lists files staged for this commit.
staged=$(git diff --cached --name-only --diff-filter=ACMR)
needs_smoke=0
for p in "${APP_PATHS[@]}"; do
  if printf '%s\n' "$staged" | grep -q "^$p"; then
    needs_smoke=1
    break
  fi
done

if [ "$needs_smoke" = "0" ]; then
  echo "[ smoke ] No app-code changes staged — skipping running-app smoke gate."
  exit 0
fi

echo "[ smoke ] App-code changes staged — running real-app smoke gate..."
if [ ! -x "scripts/smoke-launch.sh" ]; then
  echo "[ smoke ] ERROR: scripts/smoke-launch.sh missing or not executable." >&2
  exit 3
fi

# Give the cold build headroom; smoke-launch.sh defaults to 600s.
set +e
scripts/smoke-launch.sh "${SMOKE_TIMEOUT:-900}"
result=$?
set -e

case "$result" in
  0)
    echo "[ smoke ] PASS: app booted without a startup panic. Commit allowed."
    exit 0
    ;;
  1)
    echo "[ smoke ] FAIL: app panicked on launch. Commit BLOCKED." >&2
    echo "[ smoke ] Fix the startup panic, then re-stage and commit." >&2
    exit 1
    ;;
  2)
    echo "[ smoke ] INCONCLUSIVE: no boot marker within timeout (cold build too" >&2
    echo "[ smoke ] slow, hung, or no display). Soft-passing to avoid breaking" >&2
    echo "[ smoke ] commits on headless boxes — re-run 'pnpm smoke' before releasing." >&2
    exit 0
    ;;
  3)
    echo "[ smoke ] ENV FAIL: dev server / build could not start. Commit BLOCKED." >&2
    exit 3
    ;;
  *)
    echo "[ smoke ] Unexpected smoke exit $result. Blocking commit to be safe." >&2
    exit 1
    ;;
esac
