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
