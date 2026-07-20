#!/usr/bin/env python3
"""Fork hygiene guard: conflict markers + un-rebranded upstream branding.

Scans the source trees for leftover git conflict markers and any hyprnote/anarlog
branding the rebrand sweep should have renamed. S3 bucket hostnames
(hyprnote.s3.us-east-1.amazonaws.com) are exempt — those are external infra, not
product branding, and must keep their original name so model downloads work.

Exits non-zero if any hygiene violation is found.
"""

import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

SEARCH_ROOTS = ["apps", "crates", "packages", "plugins"]
SKIP_DIRS = {"target", "node_modules", ".git", ".next", "dist"}
TEXT_EXT = {
    ".rs",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".toml",
    ".json",
    ".md",
    ".yaml",
    ".yml",
    ".css",
    ".html",
    ".snap",
}
# Files produced by lingui; their msgid/msgstr legitimately contain source text.
SKIP_FILES = {"messages.po"}
# Absolute-path substrings to skip entirely: historical/prose docs that may
# legitimately name the upstream origin (e.g. "fork of Anarlog", changelog notes).
SKIP_PATH_PATTERNS = [
    "docs/FORK_PLAN.md",
    "docs/COMMERCIAL_FEATURES.md",
    "docs/_REMOVED_AUTH.md",
    "docs/code_review.md",
    "packages/changelog/content",
]

CONFLICT_RE = re.compile(r"^(<{7}|>{7}|={7})( |$)")
BRAND_RE = re.compile(r"\b(hyprnote|Hyprnote|HYPRNOTE|anarlog|Anarlog|ANARLOG)\b")
# Exempt: S3 bucket hostname is external infra, not product branding.
S3_HOST_RE = re.compile(r"hyprnote\.s3\.")


def iter_files():
    for root in SEARCH_ROOTS:
        base = os.path.join(REPO_ROOT, root)
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                ext = os.path.splitext(fn)[1].lower()
                if ext not in TEXT_EXT or fn in SKIP_FILES:
                    continue
                full = os.path.join(dirpath, fn)
                norm = full.replace("\\", "/")
                if any(p in norm for p in SKIP_PATH_PATTERNS):
                    continue
                yield full


def main():
    violations = 0

    for path in iter_files():
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
        except OSError:
            continue

        rel = os.path.relpath(path, REPO_ROOT)
        for i, line in enumerate(lines, 1):
            if CONFLICT_RE.match(line):
                print(f"[ Err ] conflict marker in {rel}:{i}: {line.rstrip()}")
                violations += 1
                continue
            m = BRAND_RE.search(line)
            if m and not S3_HOST_RE.search(line):
                print(
                    f"[ Err ] un-rebranded '{m.group(1)}' in {rel}:{i}: {line.rstrip()}"
                )
                violations += 1

    if violations:
        print(f"[ Err ] hygiene guard failed: {violations} violation(s).")
        sys.exit(1)
    print("[ Ok  ] hygiene guard passed.")
    sys.exit(0)


if __name__ == "__main__":
    main()
