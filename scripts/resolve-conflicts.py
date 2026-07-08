#!/usr/bin/env python3
"""Resolve the current rebase/merge conflicts using fork-ownership.toml.

Polarity assumes `git rebase <fork-branch> --onto upstream-track` (fork commits
replayed onto upstream): "ours" = upstream-track, "theirs" = the fork commit.
  fork     -> keep theirs   | upstream -> keep ours | delete -> rm
Longest-matching glob wins; unlisted paths default to upstream.

Generated/lock files are handled by the .gitattributes keep-ours driver, so
they shouldn't appear here. Prints what it did; exits 0.
"""

import fnmatch
import os
import subprocess
import sys
import tomllib

ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
).stdout.strip()
os.chdir(ROOT)

# The manifest path is overridable so the sync driver can point at a snapshot
# taken OUTSIDE the working tree: during a rebase the early fork commits don't
# yet contain fork-ownership.toml (it's added by a later commit), so reading it
# from ROOT would fail mid-replay.
MANIFEST = os.environ.get("FORK_OWNERSHIP_TOML") or os.path.join(
    ROOT, "fork-ownership.toml"
)
with open(MANIFEST, "rb") as f:
    M = tomllib.load(f)
DELETE = M["paths"].get("delete", [])
FORK = M["paths"].get("fork", [])


def matches(path, glob):
    if glob.endswith("/**"):
        return path == glob[:-3] or path.startswith(glob[:-2])
    return fnmatch.fnmatch(path, glob)


def owner(path):
    best, best_len = "upstream", -1
    for name, globs in (("delete", DELETE), ("fork", FORK)):
        for g in globs:
            if matches(path, g) and len(g) > best_len:
                best, best_len = name, len(g)
    return best


def git(*args):
    subprocess.run(["git", *args], capture_output=True, text=True)


def conflicts():
    out = subprocess.run(
        ["git", "status", "--porcelain"], capture_output=True, text=True
    ).stdout.splitlines()
    for line in out:
        st, path = line[:2], line[3:].strip().strip('"')
        if st in ("UU", "AA", "UD", "DU", "DD", "AU", "UA"):
            yield st, path


def pathspec(glob):
    """fork-ownership glob -> a git pathspec (dir for /**, literal otherwise)."""
    return glob[:-3] if glob.endswith("/**") else glob


def enforce(ref):
    """Post-rebase enforcement that conflict-resolution alone can't guarantee:

    1. Force every fork-owned path to the fork's version (from <ref>, the
       pre-rebase fork tip). git AUTO-MERGES non-conflicting hunks and can
       silently drop fork content in fork-owned files (e.g. settings.ts losing
       its keys) — those never surface as conflicts, so the resolver never
       sees them. 'fork-owned' means fork wins unconditionally, so we restore.
    2. Enforce the delete-list. The remove-commercial commit only deletes
       files that existed at fork time; NEW upstream files under a deleted dir
       (e.g. apps/api/* added in a later release) slip through the rebase.
    """
    restored = 0
    for g in FORK:
        ps = pathspec(g)
        diff = subprocess.run(
            ["git", "diff", "--name-only", ref, "--", ps],
            capture_output=True,
            text=True,
        ).stdout.split()
        if diff:
            git("checkout", ref, "--", ps)
            restored += len(diff)
    deleted = 0
    for g in DELETE:
        ps = pathspec(g)
        files = subprocess.run(
            ["git", "ls-files", "--", ps], capture_output=True, text=True
        ).stdout.split()
        if files:
            git("rm", "-rfq", "--", ps)
            deleted += len(files)
    print(f"enforced: fork-restored={restored} deleted={deleted}")


def main():
    counts = {"fork": 0, "upstream": 0, "delete": 0}
    for st, path in conflicts():
        o = owner(path)
        counts[o] += 1
        if o == "delete":
            git("rm", "-q", "--", path)
        elif o == "fork":  # keep theirs (the fork commit)
            if st in ("DU", "DD"):
                git("rm", "-q", "--", path)
            elif st == "UD":
                git("add", "--", path)
            else:
                git("checkout", "--theirs", "--", path)
                git("add", "--", path)
        else:  # upstream: keep ours (upstream-track)
            if st in ("UD", "DD"):
                git("rm", "-q", "--", path)
            elif st == "DU":
                git("add", "--", path)
            else:
                git("checkout", "--ours", "--", path)
                git("add", "--", path)
    print(
        f"resolved: fork={counts['fork']} upstream={counts['upstream']} "
        f"delete={counts['delete']}"
    )
    # report any markers the routing missed
    left = subprocess.run(
        ["git", "diff", "--check"], capture_output=True, text=True
    ).stdout
    if left.strip():
        print("WARNING: leftover conflict markers:\n" + left, file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--enforce":
        enforce(sys.argv[2])
    else:
        main()
