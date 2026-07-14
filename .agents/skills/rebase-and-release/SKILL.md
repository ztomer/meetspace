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
