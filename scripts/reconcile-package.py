#!/usr/bin/env python3
"""Reconcile apps/desktop/package.json after a sync.

package.json is not fork-owned (it tracks upstream), so the rebase takes
upstream's. That silently drops the fork's own scripts (visual:*) and devDeps
(@playwright/test). This restores fork-ONLY scripts + deps (anything the fork
has that the upstream tag doesn't), then applies the manifest [deps] add/remove.

Usage: reconcile-package.py <fork-ref> <upstream-tag>
  fork-ref: pre-rebase fork tip (source of fork-only scripts/deps)
  upstream-tag: the synced upstream release (to diff "fork-only" against)
"""

import json
import os
import subprocess
import sys
import tomllib

P = "apps/desktop/package.json"
MANIFEST = os.environ.get("FORK_OWNERSHIP_TOML") or "fork-ownership.toml"


def show(ref):
    r = subprocess.run(
        ["git", "show", f"{ref}:{P}"], capture_output=True, text=True
    )
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {}


def main():
    fork_ref, tag = sys.argv[1], sys.argv[2]
    deps_cfg = tomllib.load(open(MANIFEST, "rb")).get("deps", {})

    cur = json.load(open(P))
    fork = show(fork_ref)
    up = show(tag)

    # 1. Preserve fork-ONLY scripts (upstream lacks them) — e.g. visual:*.
    up_scripts = up.get("scripts", {})
    added_s = []
    for k, v in fork.get("scripts", {}).items():
        if k not in up_scripts:
            if cur.get("scripts", {}).get(k) != v:
                added_s.append(k)
            cur.setdefault("scripts", {})[k] = v

    # 2. Preserve fork-ONLY deps/devDeps (upstream lacks them) — e.g. playwright.
    up_all = {**up.get("dependencies", {}), **up.get("devDependencies", {})}
    cur_all = lambda: {
        **cur.get("dependencies", {}),
        **cur.get("devDependencies", {}),
    }
    added_d = []
    for sec in ("dependencies", "devDependencies"):
        for k, v in fork.get(sec, {}).items():
            if k not in up_all and k not in cur_all():
                cur.setdefault(sec, {})[k] = v
                added_d.append(k)

    # 3. Manifest deps: remove commercial packages, add fork-required ones.
    for k in deps_cfg.get("remove", []):
        cur.get("dependencies", {}).pop(k, None)
        cur.get("devDependencies", {}).pop(k, None)
    for k in deps_cfg.get("add", []):
        if k not in cur_all():
            cur.setdefault("dependencies", {})[k] = "*"

    for sec in ("dependencies", "devDependencies"):
        if sec in cur:
            cur[sec] = dict(sorted(cur[sec].items()))

    json.dump(cur, open(P, "w"), indent=2)
    open(P, "a").write("\n")
    print(f"package.json: +scripts {added_s or '[]'} +deps {added_d or '[]'}")


if __name__ == "__main__":
    main()
