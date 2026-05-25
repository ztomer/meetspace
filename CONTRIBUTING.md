# Contributing

This is a **local-only fork** of [Anarlog](https://github.com/fastrepl/anarlog). Cloud / Pro / Supabase / Stripe / billing / OAuth-callback features have been ripped out; all transcription, LLM, and integrations run on-device or via user-supplied tokens.

For the original project's developer docs see https://char.com/docs/developers.

## Layout

- `docs/FORK_PLAN.md` — phased plan, kept in lock-step with progress.
- `docs/COMMERCIAL_FEATURES.md` — inventory of every commercial surface in upstream and what this fork does with it.
- `docs/_REMOVED_AUTH.md` — recipe for re-removing upstream auth/billing code after a rebase.
- `apps/desktop/` — the Tauri app. Only `apps/*` left after the fork.
- `apps/desktop/src/integrations/` — Obsidian, Notion, Linear (BYO-token).
- `apps/desktop/src/settings/integrations/` — settings UI for the above.

## Local dev

Convenience scripts in `scripts/`:

```
./scripts/run.sh        # launch the app in dev mode (vite + tauri dev)
./scripts/build.sh      # install + typecheck + cargo check + vite bundle (no installer)
./scripts/package.sh    # produce a distributable .dmg / .app / .deb / .msi
```

Pass `package.sh dmg` (or `app`, `deb`, `msi`, `nsis`, `appimage`) to limit
the bundle targets. Binaries are unsigned — Gatekeeper will warn on first
launch unless you configure signing.

Day-to-day raw commands:

```
pnpm install
pnpm -F desktop typecheck         # always run this after TS changes
cargo check                       # after Rust changes
pnpm exec dprint fmt              # before committing
```

## Maintaining the fork

To pull in upstream Anarlog changes:

```
./scripts/rebase-on-main.sh           # rebase onto latest stable desktop_vX.Y.Z tag
./scripts/rebase-on-main.sh --on-main # rebase onto origin/main instead
```

The script:
1. Fetches `origin` branches + tags (assumed = upstream).
2. Picks the rebase target:
   - Default: the most recent stable tag matching `desktop_vX.Y.Z`
     (skipping `…-nightly.N` prereleases). Exits early if HEAD already
     contains it.
   - `--on-main`: forces rebase onto `origin/main` regardless of tags.
3. Rebases the current branch onto the target.
4. Re-applies our deletions of auth/billing/Supabase files using the list in `docs/_REMOVED_AUTH.md`.
5. Runs `pnpm install`, `pnpm -F desktop typecheck`, and `cargo check`.

**Do NOT push to the existing `origin` remote.** It points at the upstream Anarlog repo. A new origin will be added later. The script never pushes.

When upstream changes anything in `apps/desktop/src/auth/` or `apps/desktop/src/settings/ai/{stt,llm}/`, expect manual conflict resolution — those are our biggest hotspots.

## Branch naming

`fix/`, `chore/`, `refactor/`, `fork/` prefixes.

## Code style

See `AGENTS.md` for the inherited project conventions (dprint, oxfmt, TanStack Query patterns, etc.).
