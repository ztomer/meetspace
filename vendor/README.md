# vendor/

Third-party Rust crates we vendor in-tree via `git subtree --squash`. Cargo references them as `path = "vendor/<name>/<crate>"` instead of the `git = "https://…"` form, so:

- Builds are deterministic — no remote fetch required at compile time.
- We can patch locally without forking on GitHub.
- Future upstream updates land via `git subtree pull` and conflict cleanly.

## Why these are vendored

Each was previously a `fastrepl/*` git dep in our top-level `Cargo.toml`. Vendoring is part of the local-only fork's effort to sever upstream-namespace references (see `docs/FORK_PLAN.md`).

| Path | Upstream when added | Rev / branch | Notes |
|---|---|---|---|
| `vendor/async-openai` | `https://github.com/fastrepl/async-openai` | `6404d307` | Fork pinned to an older API than canonical 64bit/async-openai; canonical main has renamed several `ChatCompletionRequest*` types our consumers (`crates/llm-types`) still depend on. Switch base to canonical when we're willing to adapt consumers. |
| `vendor/gbnf-validator` | `https://github.com/fastrepl/gbnf-validator` | `main` | Tiny GBNF grammar validation tool. No known canonical upstream — fastrepl's fork is the only source. |

## How to refresh

```bash
# Pull the latest from the same branch we vendored from
./scripts/refresh-vendor.sh async-openai     # uses the upstream + ref recorded below
./scripts/refresh-vendor.sh gbnf-validator
```

Or manually:

```bash
git fetch <upstream-url> <branch-or-ref>
git subtree pull --prefix=vendor/<name> <upstream-url> <branch-or-ref> --squash
```

If `subtree pull` reports conflicts, resolve them in-tree (they'll be on real files under `vendor/<name>/…`), `git add`, then `git commit`. The refresh script does this for you and surfaces conflicts cleanly.

## When to switch the upstream base

When canonical upstream has features / fixes you want and the API drift is small. For `async-openai` specifically, the canonical `64bit/async-openai` is far ahead — switching means a small refactor in `crates/llm-types` to use the new `ChatCompletionRequest*` shapes. Worth it when we're done with bigger work.
