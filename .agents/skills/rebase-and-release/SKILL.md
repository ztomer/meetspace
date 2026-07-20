---
name: rebase-and-release
description: Automate rebasing the Meetspace local-first fork onto upstream stable releases, force-pushing to the Meetspace GitHub repository, and packaging the macOS DMG installer.
---

## Rebase & Release Workflow

This skill automates the process of rebasing the local-first `meetspace` fork onto upstream stable release tags from `fastrepl/anarlog`, pushing the branch to `ztomer/meetspace`, and compiling the optimized release installer (DMG).

### Steps

1. **Verify Git Working Tree is Clean**
   Ensure all local changes are committed or stashed:
   ```bash
   git status
   ```

2. **Trigger the Rebase, Push, and DMG Package Pipeline**
   Run the unified automation script:
   ```bash
   ./scripts/rebase-push-release.sh [branch_name]
   ```
   *By default, the script rebases the current branch, pushes it to the `meetspace` remote on GitHub, and compiles the macOS DMG.*

3. **Options and Flags**
   If you have already rebased manually (or resolved conflicts) or want to skip certain steps, use these flags:
   - **Skip Rebase**: If you have already rebased or solved conflicts:
     ```bash
     ./scripts/rebase-push-release.sh --no-rebase
     ```
   - **Skip Push**: If you only want to rebase and package locally without pushing:
     ```bash
     ./scripts/rebase-push-release.sh --no-push
     ```
    - **Custom Branch**: Specify a target branch to push/package if not the current branch:
      ```bash
      ./scripts/rebase-push-release.sh my-feature-branch
      ```

### Cutting a Full Release (auto-updates Homebrew)

To rebase, push, and publish a GitHub release in one command, use `--release`.
Instead of building a local dev DMG, this cuts the tag + GitHub release, which
triggers the `Build & Release Artifacts` workflow. That workflow builds the
stable DMG **and auto-updates the `ztomer/homebrew-tap` cask** from
`scripts/brew/meetspace.rb` (with a manual-push fallback if CI times out).

```bash
# Bump to a specific meet version, then release (Homebrew updates automatically):
./scripts/rebase-push-release.sh --release --version 1.1.16-meet1

# Or let the version be derived from the latest upstream stable tag in HEAD:
./scripts/rebase-push-release.sh --release
```

`--version` accepts either form (`1.1.16-meet1` == `1.1.16_meet1`) and bumps
`apps/desktop/src-tauri/Cargo.toml`, `Cargo.lock`, and
`scripts/brew/meetspace.rb`, committing the bump before the release. Under the
hood `--release` delegates to `scripts/push_release.sh`, which pushes `MIT_BACK`,
recreates the tag, creates the GitHub release, watches the CI build, and polls
the Homebrew tap to confirm the cask moved.

### Cutting a Local Release (CI disabled)

This fork has **all GitHub Actions workflows set to `on: []` by design** (no CI
build). The `--release` path above therefore hangs waiting on a CI run that
never starts. Use `--local` instead: it builds the stable DMG on this machine
and uploads it to the GitHub release directly.

```bash
# Bump to a new meet version, then build + upload the DMG locally:
./scripts/rebase-push-release.sh --local --version 1.3.1-meet2

# Or build + upload for the version already in scripts/brew/meetspace.rb:
./scripts/rebase-push-release.sh --local --no-rebase
```

`--local` pushes the branch, runs `package.sh stable dmg`, creates/deletes the
tag, and `gh release create` + uploads the `.dmg`. Prefer `--local` over
`--release` in this repo.

### Release-Link Verification (CRITICAL)

`cargo check`, `pnpm -r typecheck`, and the **debug** smoke test (`pnpm smoke`)
all PASS even when the **release** build is broken. The release link is the
only gate that catches certain classes of failure:

- **Duplicate native symbol collisions** — e.g. two SQLite implementations
  statically linked into one binary (`libsql`'s `libsql_ffi` vs sqlx's
  `libsqlite3-sys`) produce `duplicate symbol '_sqlite3_*'` at **release link
  time only**. Debug builds demote this to a warning, so it ships silently.
- **Fix pattern:** unify on ONE native backend. Here, repoint the importer's
  `legacy/db-parser` from `libsql` onto `rusqlite` whose `libsqlite3-sys`
  version matches sqlx's (rusqlite `0.37` → `libsqlite3-sys ^0.35`; sqlx here
  is `0.35.0`). Then delete the libsql carriers (`legacy/db-core`,
  `legacy/db-user`). Do NOT "fix" by removing the *obvious* cloud feature
  (e.g. cloudsync) — cloudsync uses sqlx's `libsqlite3-sys` too, so it is a
  **red herring**; verify the actual duplicate with a release build before
  assuming which crate is at fault.
- **Verify before declaring a round complete:** run a real
  `cargo build --release` (or `package.sh stable dmg`) and confirm it links
  with zero `duplicate symbol` errors. This is the gate the debug smoke
  missed.

### Keeping the Fix Across Rebases

The rusqlite-only sqlite link must survive upstream rebases. Record fork-owned
deletions so `rebase-on-main.sh` and `resolve_conflicts.py` auto-strip them:
- `legacy/db-core` and `legacy/db-user` are listed in both scripts'
  `REMOVED_DIRS` and in `.agents/fork-ownership.toml`.
- After any rebase, if `cargo build --release` regresses with
  `duplicate symbol '_sqlite3_*'`, check that upstream didn't resurrect a
  libsql carrier, and re-add it to `REMOVED_DIRS`.

### Troubleshooting Rebase Conflicts

If `./scripts/rebase-on-main.sh` (called by the wrapper script) pauses or exits due to rebase conflicts:
1. Resolve the conflicts in your editor.
2. Note that most conflicts are upstream trying to resurrect files that this fork intentionally deleted (such as Supabase integrations, OAuth/auth stubs, telemetry, and web apps). Keep them deleted.
3. Once conflicts are resolved, continue the rebase:
   ```bash
   git rebase --continue
   ```
4. Run the rest of the pipeline using `--no-rebase`:
   ```bash
   ./scripts/rebase-push-release.sh --no-rebase
   ```

### Outputs
The generated DMG installer will be saved at:
- `target/release/bundle/dmg/`
- `apps/desktop/src-tauri/target/release/bundle/dmg/`
