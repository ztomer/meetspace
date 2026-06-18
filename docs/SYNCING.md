# Syncing the fork with upstream

`meetspace` is a fork of `fastrepl/anarlog`. Fork work lives on `MIT_BACK`;
upstream is `origin/main`. This doc describes how to pull in newer upstream
releases with the least pain.

## The upstream-track model

The fork is structured as **upstream + a couple of fork commits**, not a long
sprawl of commits diverging from a far-back base:

- **`upstream-track`** — a *regenerated* branch = a chosen upstream release with
  the meetspace rebrand applied (`scripts/rebrand_sweep.py`). It shares the
  fork's naming, so the rename never shows up in diffs against it.
- **`MIT_BACK`** — `upstream-track` + two fork commits: one that removes
  commercial/cloud + cactus (deletions), one with the meetspace customizations
  (local-first AI, integrations, theming, tooling, visual tests).

Why: because `upstream-track` is already rebranded, rebasing the fork commits
onto a freshly-rebuilt `upstream-track` produces **substantive-only conflicts**
— the `hypr→meetspace` rename (the bulk of raw churn) never conflicts. Generated
files are handled by merge drivers; commercial paths by the deletions commit +
the `REMOVED_*` lists. The fork IS a heavy divergence (~hundreds of modified
desktop source files), so a sync is still a real merge — but a clean, reviewable
one in a couple of passes, not 186.

### Syncing to a new release

```bash
git checkout -b sync/<ver> MIT_BACK     # throwaway working branch
scripts/sync-upstream.sh desktop_v1.0.45
```

It rebuilds `upstream-track` at the tag (+ rebrand), rebases the fork commits
onto it, re-strips commercial, regenerates i18n, and verifies. Resolve any
substantive conflicts per the resolution rule below, review, then fast-forward
`MIT_BACK` to the synced branch and push.

**`fork-ownership.toml` + `scripts/resolve-conflicts.py` do the mechanical
routing.** The manifest is the single source of truth for "which side wins":
`[paths] delete` (commercial/cloud → `git rm`), `[paths] fork` (fork-owned →
keep the fork's version), everything else → upstream. The resolver reads it and
auto-resolves every conflicted path by longest-matching glob, so a sync is
mostly: run the script, eyeball the few genuinely ambiguous files, verify. When
you add or move a fork-owned area, update the manifest — that's what keeps the
next sync deterministic. `[providers]` and `[deps]` in the manifest mirror the
provider allowlist and the package.json reconciliation described below.

After the rebase, the driver runs two enforcement passes that conflict
resolution alone can't guarantee (both are things `git` does *without* flagging
a conflict, so the resolver never sees them):
- **`resolve-conflicts.py --enforce <fork-ref>`** restores every fork-owned path
  to the fork's version (git auto-merges non-conflicting hunks and can silently
  drop fork content — e.g. `settings.ts` losing its keys) and applies the
  delete-list to *new* upstream files that landed under a deleted dir.
- **`reconcile-package.py <fork-ref> <tag>`** re-adds fork-only `package.json`
  scripts (`visual:*`) and devDeps (`@playwright/test`) that taking upstream's
  `package.json` drops, then applies `[deps]` add/remove.
- **`reconcile-cargo.py <fork-ref> <tag>`** does the same for the root
  `Cargo.toml`: drops delete-listed `[workspace].members` (e.g. `apps/api`) and
  restores fork-only `[workspace.dependencies]` path deps (e.g. the fork's
  `tauri-plugin-diarize`/`-oauth`).

`scripts/sync-upstream.sh` also guards against re-runs: if `upstream-track` is
already at the target tag (a prior/aborted run advanced it), `PREV_TRACK` would
be wrong, so it refuses and tells you to reset the branch to the previous track.

## One-time setup (per clone)

```bash
bash scripts/setup-fork-git.sh
```

Enables `git rerere` (auto-replays repeated conflict resolutions), registers
the `keep-ours` merge driver for generated files, and installs the pre-push
guard. Re-run after a fresh clone.

## Routine sync

```bash
scripts/rebase-on-main.sh            # latest stable desktop_vX.Y.Z tag
scripts/rebase-on-main.sh --on-main  # bleeding edge (origin/main)
```

The script: enables rerere → rebases → re-removes deleted upstream paths →
runs `rebrand_sweep.py` → regenerates i18n → formats → builds UI → typecheck →
`cargo check` → `check-clean.py`. It never pushes.

When the rebase stops on a conflict, resolve it, `git add`, `git rebase
--continue`. rerere remembers each resolution, so the *same* conflict
(overwhelmingly the `hypr → meetspace` rename) is auto-resolved next time it
recurs in a later commit or a future sync.

### Resolution rule (when a conflict needs a human/agent decision)

This fork takes upstream as-is, strips the commercial bits, and runs locally.
So:

- **UI / features / components / behavior → upstream wins.** Take the upstream
  side; do not preserve the fork's older version of a feature.
- **The fork's only deltas are:** (1) remove commercial/cloud — auth, billing,
  Supabase, accounts, api/web/stripe apps, paid gating, cloud sync (keep those
  removals / local stubs); (2) local-first defaults (local STT/LLM, no cloud
  calls); (3) the `hypr/anarlog → meetspace` rebrand (applied last by
  `rebrand_sweep.py`).

In short: conflict in feature/UI code → take upstream; conflict in
auth/billing/cloud → keep the fork's removal/stub.

**Hide, don't delete.** Prefer hiding commercial surface over deleting upstream
code — it keeps syncs clean. AI providers do this: `settings/ai/shared/local-
providers.ts` holds the local allowlists, and `llm/shared.tsx` / `stt/shared.tsx`
split their list into `_UPSTREAM_PROVIDERS` + `_FORK_PROVIDERS`, compose them,
then gate `PROVIDERS` through `keepLocalProviders(...)`.

**At sync, for each of those files:** replace `_UPSTREAM_PROVIDERS` with
upstream's full `_PROVIDERS` array verbatim (don't trim it), and **keep
`_FORK_PROVIDERS`** (the providers this fork adds that upstream lacks — osaurus
+ custom for LLM, the local "meetspace" STT provider). The allowlist hides
upstream's cloud entries; keeping the full provider type avoids the enhance/
provider type-drift that trimming caused. `local-providers.test.ts` fails if a
hosted provider becomes visible. Adding a local provider = add it to
`_FORK_PROVIDERS` and its id to the allowlist.

### What is handled for you

- **Generated/lock files** (`Cargo.lock`, `pnpm-lock.yaml`,
  `i18n/locales/**`, `*.gen.ts`, `*.gen.json`) never conflict — `.gitattributes`
  routes them to the `keep-ours` driver, and the script regenerates the i18n
  catalogs afterward. (Bindings regenerate on the next `pnpm -F desktop build`.)
- **Deleted upstream paths** that upstream tries to resurrect are re-removed
  from the `REMOVED_*` lists in `scripts/rebase-on-main.sh`. Add to those lists
  when you delete new upstream areas.
- **Rebrand** is applied by `scripts/rebrand_sweep.py` (idempotent), not by
  hand.

### Guard

`scripts/check-clean.py` fails on leftover conflict markers or un-rebranded
identifiers in `apps/crates/packages/plugins`. It runs in the rebase script,
on `git push` (pre-push hook), and in CI (`.github/workflows/fork-guard.yml`).
It's a python port of the old shell guard — `git grep` got mangled by the local
RTK shell hook into false positives, so the guard enumerates files with
`git ls-files` and scans them in-process instead.

## Why syncs are expensive — and the long-term fix

The fork carries a global `hypr → meetspace` rename **in source**, and upstream
PRs are **cherry-picked** (new SHAs), so git replays them onto a rebranded base
and conflicts on essentially every touched import. Conflict volume scales as
*(commits replayed × files touched)*.

The mitigations above (rerere + generated-file drivers + idempotent sweep) make
this tractable. The structural fix, if syncs stay painful, is to stop carrying
the rename in source:

1. Keep an **`upstream-track`** branch that mirrors `origin/main` verbatim
   (no rebrand).
2. Maintain fork changes as a **small curated patch series** on top of it
   (squash the historical `fork(phase N)` iterations into a handful of feature
   commits).
3. Apply the rebrand as the **last step** (`rebrand_sweep.py`) — or at build
   time — so the integration branch never diverges from upstream on naming.

Then a sync is `git rebase --onto origin/main upstream-track <fork-patches>`
followed by the sweep: a dozen real patches to reconcile instead of a hundred
rename-conflicted commits.
