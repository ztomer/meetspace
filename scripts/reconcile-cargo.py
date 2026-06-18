#!/usr/bin/env python3
"""Reconcile root Cargo.toml after a sync (the cargo analogue of
reconcile-package.py).

Root Cargo.toml is not fork-owned, so the rebase takes upstream's. That breaks
the workspace two ways, neither of which surfaces as a conflict:
  1. Deleted crates stay in [workspace].members (e.g. apps/api) -> cargo can't
     load the workspace at all.
  2. Fork-only [workspace.dependencies] path entries are dropped (e.g. the
     fork's tauri-plugin-diarize / -oauth) -> members referencing them fail.

This drops delete-listed members and restores fork-only path deps (computed by
diffing the fork ref against the upstream tag, so new fork plugins are picked up
automatically). Text-edited to preserve upstream's formatting/ordering.

Usage: reconcile-cargo.py <fork-ref> <upstream-tag>
"""

import os
import re
import subprocess
import sys
import tomllib

P = "Cargo.toml"
MANIFEST = os.environ.get("FORK_OWNERSHIP_TOML") or "fork-ownership.toml"


def toml_at(ref):
    r = subprocess.run(
        ["git", "show", f"{ref}:{P}"], capture_output=True, text=True
    )
    return tomllib.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {}


def matches(path, glob):
    if glob.endswith("/**"):
        return path == glob[:-3] or path.startswith(glob[:-2])
    return path == glob


def main():
    fork_ref, tag = sys.argv[1], sys.argv[2]
    delete = tomllib.load(open(MANIFEST, "rb"))["paths"].get("delete", [])
    text = open(P).read()

    cur = tomllib.loads(text)
    fork_deps = fork_ref and toml_at(fork_ref).get("workspace", {}).get("dependencies", {})
    up_deps = toml_at(tag).get("workspace", {}).get("dependencies", {})
    cur_deps = cur.get("workspace", {}).get("dependencies", {})

    # 1. Restore fork-only path deps (fork has them, upstream tag doesn't).
    add_lines, added = [], []
    for name, spec in (fork_deps or {}).items():
        if name in up_deps or name in cur_deps:
            continue
        if isinstance(spec, dict) and set(spec) == {"path"}:
            add_lines.append(f'{name} = {{ path = "{spec["path"]}" }}')
            added.append(name)
    if add_lines:
        new_text, n = re.subn(
            r"^\[workspace\.dependencies\]$",
            lambda m: m.group(0) + "\n" + "\n".join(add_lines),
            text,
            count=1,
            flags=re.M,
        )
        if n:
            text = new_text
        else:
            added = []

    # 2. Drop delete-listed workspace members.
    removed = []
    for m in cur.get("workspace", {}).get("members", []):
        if any(matches(m, g) for g in delete):
            text2 = re.sub(
                r'^[ \t]*"' + re.escape(m) + r'",?[ \t]*\n', "", text, count=1, flags=re.M
            )
            if text2 != text:
                text, _ = text2, removed.append(m)

    open(P, "w").write(text)
    print(f"Cargo.toml: +deps {added or '[]'} -members {removed or '[]'}")


if __name__ == "__main__":
    main()
