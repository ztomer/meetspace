#!/usr/bin/env python3
"""Fork hygiene guard (RTK-robust). Fails (exit 1) if the tracked tree has:
  1. leftover merge-conflict markers, or
  2. un-rebranded upstream identifiers in source code.

Run by the pre-push hook, scripts/sync-upstream.sh, and CI. This is a python
port of the old check-clean.sh: the shell version used `git grep`, which the
RTK shell hook rewrites into a mangled multi-pattern regex and floods with
false positives. We enumerate files with `git ls-files` and scan in-process,
so no command is reachable by the hook.
"""
import os
import re
import subprocess
import sys

ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
).stdout.strip()
os.chdir(ROOT)

MARKER = re.compile(r"^(<{7}|>{7}|\|{7}) ", re.MULTILINE)
# IGNORECASE so `hyprnote`/`Hyprnote`/`HYPRNOTE` and `anarlog`/`Anarlog`/`ANARLOG`
# are all caught; the shell guard's case-literal list missed bare lowercase
# `hyprnote` (e.g. in generated openapi descriptions).
BRAND = re.compile(r"@hypr/|hypr[_-]|hyprnote|anarlog", re.IGNORECASE)

# Brand scan is restricted to authored code dirs; translation catalogs and
# historical changelogs legitimately retain old strings, and generated files
# (*.gen.ts/json) regenerate on build (routed to keep-ours by .gitattributes),
# so they're not the guard's concern.
BRAND_DIRS = ("apps/", "crates/", "packages/", "plugins/")
BRAND_EXCLUDE = ("/i18n/locales/", "packages/changelog/content/", ".gen.")


def tracked():
    out = subprocess.run(
        ["git", "ls-files", "-z"], capture_output=True, text=True
    ).stdout
    return [p for p in out.split("\0") if p]


def read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except OSError:
        return ""


def main():
    files = tracked()
    fail = 0

    print("==> Checking for conflict markers")
    markers = [p for p in files if MARKER.search(read(p))]
    if markers:
        print("FAIL: conflict markers present in:")
        for p in markers:
            print(f"  {p}")
        fail = 1
    else:
        print("  ok")

    print("==> Checking for un-rebranded upstream identifiers in code")
    leaks = []
    for p in files:
        if not p.startswith(BRAND_DIRS):
            continue
        if any(x in p for x in BRAND_EXCLUDE):
            continue
        if BRAND.search(read(p)):
            leaks.append(p)
    if leaks:
        print("FAIL: upstream identifiers found (run: python3 scripts/rebrand_sweep.py):")
        for p in leaks:
            print(f"  {p}")
        fail = 1
    else:
        print("  ok")

    if fail:
        print("==> check-clean FAILED")
        sys.exit(1)
    print("==> check-clean passed")


if __name__ == "__main__":
    main()
