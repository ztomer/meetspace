#!/usr/bin/env bash
# Deterministic launch sanity test — REQUIRED before declaring a release round
# complete. Builds and runs the REAL Tauri app and confirms it reaches
# end-of-setup without a startup panic, then exits.
#
# Why this exists: typecheck, `cargo check`, and the visual tests all run against
# a MOCKED Tauri backend (Playwright fakes the IPC), so they cannot catch runtime
# panics in real plugin init — e.g. the tray/updater2 event-registry ordering
# panic that shipped a broken 1.0.47_meet1. This launches the actual backend.
#
# Determinism: it keys on two explicit, stable signals in the app's own log, not
# on GUI pixels, network, or timing:
#   PASS  -> "smoke: app_setup_complete"  (tracing marker at the end of lib.rs setup)
#   FAIL  -> a panic / fatal-runtime line
# A debug build is used on purpose: the plugin-init panic class fires in debug
# too, and debug skips the updater2 network check (no flakiness, no display-less
# network dependency). Needs a display (run locally or on a GUI CI runner).
#
# Usage: scripts/smoke-launch.sh [timeout_seconds]   (default 600, covers a cold build)
# Exit:  0 PASS | 1 FAIL (panic) | 2 INCONCLUSIVE (no marker before timeout)
#        3 ENV (dev server couldn't start — e.g. port busy, build error)
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Match the bare message, not "smoke: app_setup_complete" — tracing interleaves
# ANSI color codes between the target and the message, so the joined string
# never appears literally. The message alone is unique in the codebase.
MARKER="app_setup_complete"
PANIC_RE='panicked|not found in registry|fatal runtime error|Segmentation fault|Abort trap'
ENV_RE='already in use|EADDRINUSE|beforeDevCommand.*terminated|BeforeDevCommand.*failed|could not compile|error: could not'
TIMEOUT="${1:-600}"
LOG="$(mktemp -t meetspace-smoke.XXXXXX)"

# Kill any meetspace dev processes and free the dev ports. tauri:dev's vite is
# spawned via beforeDevCommand and outlives a plain kill of the tauri process,
# so we free it by PORT (the only reliable handle). Used both before launch
# (hermetic start — a leftover vite/app can't skew the result) and on exit.
free_dev() {
  pkill -f 'target/debug/meetspace' 2>/dev/null || true
  pkill -f 'tauri dev --no-watch' 2>/dev/null || true
  for p in 1422 1423 1424; do
    for pid in $(lsof -ti tcp:$p 2>/dev/null); do kill "$pid" 2>/dev/null || true; done
  done
}
free_dev
sleep 1

echo "==> Launching real app (tauri:dev); marker='$MARKER'; timeout=${TIMEOUT}s"
pnpm -F desktop tauri:dev >"$LOG" 2>&1 &
DEV_PID=$!

cleanup() {
  pkill -P "$DEV_PID" 2>/dev/null || true
  kill "$DEV_PID" 2>/dev/null || true
  free_dev
}
trap cleanup EXIT

result=2
elapsed=0
while [ "$elapsed" -lt "$TIMEOUT" ]; do
  if grep -qF "$MARKER" "$LOG"; then result=0; break; fi
  if grep -qE "$PANIC_RE" "$LOG"; then result=1; break; fi
  if grep -qE "$ENV_RE" "$LOG"; then result=3; break; fi
  if ! kill -0 "$DEV_PID" 2>/dev/null; then
    # Dev process exited before any marker. Classify by what's in the log.
    if grep -qF "$MARKER" "$LOG"; then result=0
    elif grep -qE "$PANIC_RE" "$LOG"; then result=1
    else result=3; fi
    break
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

echo "==> smoke log tail:"
tail -25 "$LOG"
case "$result" in
  0) echo "==> SMOKE PASS: reached '$MARKER', no startup panic" ;;
  1) echo "==> SMOKE FAIL (panic): startup panic — the app does not launch"; grep -nE "$PANIC_RE" "$LOG" | head ;;
  2) echo "==> SMOKE INCONCLUSIVE: no marker within ${TIMEOUT}s (cold build too slow, hung, or no display)" ;;
  3) echo "==> SMOKE ENV FAIL: dev server/build couldn't start (NOT an app panic)"; grep -nE "$ENV_RE" "$LOG" | head ;;
esac
exit "$result"
