# Syncing the fork with upstream

`meetspace` is a fork of `fastrepl/anarlog`. Fork work lives on `MIT_BACK`;
upstream is `origin/main`. This doc describes how to pull in newer upstream
releases with the least pain.

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
`cargo check` → `check-clean.sh`. It never pushes.

When the rebase stops on a conflict, resolve it, `git add`, `git rebase
--continue`. rerere remembers each resolution, so the *same* conflict
(overwhelmingly the `hypr → meetspace` rename) is auto-resolved next time it
recurs in a later commit or a future sync.

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

`scripts/check-clean.sh` fails on leftover conflict markers or un-rebranded
identifiers in `apps/crates/packages/plugins`. It runs in the rebase script,
on `git push` (pre-push hook), and in CI (`.github/workflows/fork-guard.yml`).

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
