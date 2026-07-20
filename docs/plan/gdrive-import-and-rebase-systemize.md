# Plan: Google Drive import source (local-first fork)

**Status:** Proposed — not yet implemented.
**Goal:** Add a Google Drive import source that accepts **user-provided input**
(a Google Takeout export path, or a Drive share link the user pastes), and
structure the work so it **survives future upstream rebases** with zero conflict
churn. Also fix the release link failure (CloudSync vs libsql duplicate-sqlite)
so the fork can actually ship.

---

## 1. Context & root-cause recap

- The desktop release DMG build fails at **link time** with
  `duplicate symbol '_sqlite3_*'`. Two SQLite implementations are statically
  linked into one binary:
  - `libsql_ffi` (via `libsql`) — the upstream legacy path via
    `legacy/db-core` → `legacy/db-user` → `legacy/db-parser` →
    `tauri-plugin-importer`.
  - `libsqlite3-sys` (via `sqlx`) — the fork's `crates/db-core` → `cloudsync`/
    `tauri-plugin-db` path. **This is the SAME `libsqlite3-sys 0.35` that sqlx
    uses**, so cloudsync does NOT cause a second copy.
  - `cargo check` / typecheck / **debug** smoke all pass (debug demotes the
    duplicate to a warning). Only the **release/stable** link fails. The bug is
    pre-existing on `MIT_BACK`, not introduced this session.
- **Corrected root cause (verified by release build):** the collision is
  `libsql_ffi` (libsql) vs `libsqlite3-sys` (sqlx). CloudSync was a red herring
  — it shares sqlx's single `libsqlite3-sys` and does not duplicate symbols.

**Decision — unify on `rusqlite` (proven fix):** repoint the importer's
`legacy/db-parser` from `libsql` onto `rusqlite 0.37` (which depends on the
same `libsqlite3-sys 0.35` sqlx uses). Delete the libsql carriers
`legacy/db-core` + `legacy/db-user`. This removes the second sqlite archive
entirely; cloudsync stays. **Release build confirmed linking with zero
duplicate-symbol errors after this change.** (The plan's original Step A
"strip CloudSync" was based on the wrong root cause and is superseded.)

## 2. Rebase-systematization strategy (the "systemize" requirement)

The fork must rebase cleanly onto future `desktop_vX.Y.Z` tags. Two rules:

1. **CloudSync removal must be expressed as fork-owned deletions**, recorded in
   a `fork-ownership.toml` (currently missing — see §4). The rebase script
   (`rebase-on-main.sh` / `sync-upstream.sh`) already restores fork-owned files
   and re-applies a delete-list after every rebase. We add the cloudsync crates
   + their wiring to that list so upstream's re-introduction of cloudsync is
   auto-stripped on each rebase.
2. **The Google Drive feature must be 100% additive and self-contained** inside
   `plugins/importer/` (a new `TransformKind` + a new `sources/gdrive/` module).
   It touches **no upstream core file**. On rebase, upstream changes to the
   importer's `mod.rs` dispatcher *might* need a one-line re-add of the match
   arm — but we minimize that by registering the source via a fork-owned
   extension point rather than editing `all_sources()` if possible. If editing
   `mod.rs` is unavoidable, it is a single, low-churn line.

This keeps the feature as "new files + one registration line" → minimal rebase
conflict surface.

## 3. Implementation steps

### Step A — Strip CloudSync (fixes release link)
- Remove from workspace `Cargo.toml` members: `crates/cloudsync`,
  `crates/db-change` (if cloudsync-only), and any cloudsync-only crates.
  (Verify `db-change` isn't used by the importer path; if it is, keep it but
  remove only the cloudsync observer wiring.)
- Remove `tauri-plugin-db` cloudsync callsites if they require `libsqlite3-sys`;
  keep `tauri-plugin-db` for the local DB.
- Delete/neutralize cloudsync modules in `crates/db-core/src/cloudsync/*`,
  `crates/db-app/src/cloudsync.rs`, and the `cloudsync_enabled` plumbing in
  `db-core/src/lib.rs` / `db-app/src/lib.rs` / `mobile-bridge`.
- Remove `meetspace_cloudsync` dependency from `Cargo.toml`s that reference it.
- **Verify:** `cargo build --release` for `apps/desktop/src-tauri` links
  without `duplicate symbol`. (This is the gate the debug smoke missed —
  re-run a release link as the verification, not just debug smoke.)

### Step B — Add `TransformKind::GoogleDrive` + `ImportSourceKind::GoogleDrive`
In `plugins/importer/src/types.rs`:
- Add `GoogleDrive` to `TransformKind` enum.
- Add `GoogleDrive` to `ImportSourceKind` enum.
- Add `ImportSource::google_drive(path: PathBuf)` factory (uses `from_path`
  with the user-provided path).

### Step C — New source module `plugins/importer/src/sources/gdrive.rs`
- `import_all_from_path(path)` and `import_stats_from_path(path)`.
- **User-provided input contract:** the `path` is whatever the user supplies in
  the UI (a local directory from a Google Takeout export, e.g.
  `Takeout/Google Drive/`). The module walks the export, parses supported
  files (`.gdoc`/`.gsheet` stubs → resolve to Drive metadata; `.pdf`, `.txt`,
  exported Docs/Sheets in the Takeout layout), and maps them to the importer IR
  (`EnhancedNote`/`Session`). Unsupported files are skipped with a count.
- Keep it dependency-light: parse the Takeout JSON sidecars (`.json` metadata
  files Drive emits) rather than calling the Drive API (no network, no secrets
  — consistent with local-first). If a share *link* is pasted instead of a
  path, we surface a clear error: "Download your Google Takeout export and
  point the importer at the folder."

### Step D — Register the source (rebase-safe)
- In `plugins/importer/src/sources/mod.rs`, add `mod gdrive;` and a match arm
  in `import_all` / `import_stats`.
- In `all_sources()` / `list_available_sources()`, add a
  `ImportSource::google_drive(...)` entry driven by **user input** rather than a
  fixed path. Because import is user-initiated with a path, the source appears
  in the UI as "Google Drive (Takeout export)" and reads the path the user
  provides (see Step E).
- If upstream rebases change `mod.rs`, this is the single line to re-add.

### Step E — UI: accept user-provided input
In `apps/desktop/src/settings/data/`:
- Add a "Google Drive" `SourceItem` that, instead of scanning a fixed path,
  prompts the user for the Takeout export **folder path** (or pastes a link).
- Pass that path as the second argument to `commands.runImport(kind, input)`
  (the `input` param already exists and is currently `""` — wire it through to
  `ImportSource::from_path` / `google_drive(input)`).

### Step F — Tests
- Unit test `gdrive::import_all_from_path` against a fixture Takeout folder in
  `plugins/importer/src/sources/gdrive/tests/` (or inline `#[cfg(test)]`).
- Add the gdrive source to `list_available_sources` coverage.

## 4. Fork-ownership record (enables future rebases)

Create `.agents/fork-ownership.toml` (referenced by `rebase-on-main.sh` /
`resolve_conflicts.py` as `ORIG_FORK`/ownership source) listing:

```toml
[delete]
crates = ["cloudsync", "db-change"]   # if cloudsync-only
files = [
  "crates/db-core/src/cloudsync",
  "crates/db-app/src/cloudsync.rs",
]
# Google Drive feature is ADDITIVE (plugins/importer/src/sources/gdrive.rs) —
# never in the delete list; on rebase, re-add the mod.rs match arm if upstream
# drops it.
```

(Confirm exact membership by grepping dependents before deleting — `db-change`
may serve the importer too; if so, only remove the cloudsync observer, not the
crate.)

## 5. Verification before re-cutting release

1. `cargo build --release` (or `tauri build --config tauri.conf.stable.json
   --bundles dmg`) links with **no duplicate-symbol error** — this is the gate
   the debug smoke missed. (Add a release-link check to the commit gate or a
   pre-release step so it can't regress.)
2. `pnpm -F desktop typecheck` green.
3. `cargo check` green.
4. `pnpm smoke` (debug launch) still PASS.
5. Google Drive import: unit tests pass; manual dry-run in UI against a fixture
   Takeout folder imports notes.
6. Re-run `scripts/rebase-push-release.sh --release --version 1.3.1-meet1
   --no-rebase` only after 1–5 pass, then upload the DMG to the existing
   `v1.3.1_meet1` release.

## 6. Out of scope

- Live Google Drive API sync / OAuth (network, secrets, contrary to
  local-first). Only offline Takeout-export import.
- Keeping CloudSync. It is removed per Option 1.
- Homebrew tap auto-update (CI-disabled by design; manual if desired later).
