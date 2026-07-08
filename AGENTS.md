# Overview

Tauri desktop note-taking app (`apps/desktop/`) with a web app (`apps/web/`).
Uses pnpm workspaces.
TinyBase as the primary data store (schema at `packages/store/src/tinybase.ts`), Zustand for UI state, TipTap for the editor. Sessions are the core entity — all notes are backed by sessions.

## Commands

- Format: `pnpm exec dprint fmt`
- Typecheck (TS): `pnpm -r typecheck`
- Typecheck (Rust): `cargo check`
- Desktop dev: `pnpm -F @meetspace/desktop tauri:dev`
- Web dev: `pnpm -F @meetspace/web dev`
- Dev docs: https://char.com/docs/developers

## Guidelines

- Format via dprint after making changes.
- JavaScript/TypeScript formatting runs through `oxfmt` via dprint's exec plugin.
- Run `pnpm -r typecheck` after TypeScript changes, `cargo check` after Rust changes.
- After editing files, run the relevant verification commands before finishing.
- For `apps/desktop/` TypeScript changes, prefer `pnpm -F desktop typecheck` to match CI.
- After edits, run `pnpm exec dprint fmt`.
- Use `useForm` (tanstack-form) and `useQuery`/`useMutation` (tanstack-query) for form/mutation state. Avoid manual state management (e.g. `setError`).
- For `plugins/db` live queries, keep schema creation, migrations, and DB initialization on the Rust side; TypeScript should only consume `execute`/`subscribe` APIs.
- Branch naming: `fix/`, `chore/`, `refactor/` prefixes.

## Launch sanity (required before any release / "round complete")

`pnpm -r typecheck`, `cargo check`, and the visual tests all run against a
MOCKED Tauri backend, so they CANNOT catch runtime panics in real plugin init
(e.g. tauri-specta event-registry / plugin-order panics). Before tagging a
release or declaring a round complete, run the real app and confirm it launches:

```bash
pnpm smoke        # = scripts/smoke-launch.sh
```

It builds + runs the actual app, waits for the `app_setup_complete` tracing
marker (planted at the end of `src-tauri/src/lib.rs` setup), and exits non-zero
on a startup panic. Exit codes: 0 pass, 1 panic, 2 inconclusive (timeout/no
display), 3 env (dev server couldn't start). Needs a display (local or GUI CI
runner).

## Visual change verification

Any change that alters what the user sees (desktop or web UI: layout, color,
spacing, components, dark mode, copy) is not done until it has been looked at,
not just typechecked.

Before landing a visual change:
1. **Run it as a user.** Launch the affected screen and walk the scenario the
   change touches.
2. **Capture** screenshots (and video for flows/animations) in **both light and
   dark mode** — dark-mode contrast regressions are a recurring failure here.
3. **Judge against intent.** Ask what a user expects to see and whether the
   result matches; note any contrast, overflow, alignment, or state issues.
4. **Lock it in.** Add or extend a deterministic visual test so the verified
   appearance can't silently regress.

See `docs/VISUAL_TESTING.md` for the capture loop and the snapshot harness.

## Code Style

- Avoid creating types/interfaces unless shared. Inline function props.
- Do not write comments unless code is non-obvious. Comments should explain "why", not "what".
- Use `cn` from `@meetspace/utils` for conditional classNames. Always pass an array, split by logical grouping.
- Use `motion/react` instead of `framer-motion`.

## CLI TUI Command Architecture

Choose the lightest command structure that fits the workflow.

Use the full reducer/effect/runtime split only when the command has async orchestration, a multi-step workflow, or substantial state transitions that benefit from reducer-style tests.

```
commands/<name>/
  mod.rs        -- Screen impl, Args, run()          [glue]
  app.rs        -- App or screen-local state          [optional]
  action.rs     -- Action enum                        [optional]
  effect.rs     -- Effect enum                        [optional]
  runtime.rs    -- Runtime, RuntimeEvent              [async I/O]
  ui.rs         -- draw(frame, app)                   [rendering]
```

Naming rules:
- Types drop the command prefix: `App`, `Action`, `Effect`, `Runtime`, `RuntimeEvent`
- `app.rs` → `app/mod.rs` with private submodules when state is complex
- `ui.rs` → `ui/mod.rs` with sub-files when rendering is complex
- `action.rs`/`effect.rs` are siblings of `mod.rs` when they exist; do not create them by default for simple list/detail screens
- `app.rs` contains no rendering logic, no API calls, no async code when using the reducer pattern
- Prefer `screen.rs` plus a small local state struct for simple browse/select flows
- Do not add parent-level action/effect translation layers that proxy child workflows through another command's reducer

## Misc

- Do not create summary docs or example code files unless requested.
