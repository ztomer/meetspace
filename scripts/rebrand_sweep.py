#!/usr/bin/env python3
import os
import re
import sys


def print_info(message):
    """Prints an informational message."""
    print(f"[ ==> ] {message}")


def print_wrn(message):
    """Prints a warning message."""
    print(f"[ Wrn ] {message}")


def print_err(message):
    """Prints an error message."""
    print(f"[ Err ] {message}")


def print_ok(message):
    """Prints a success message."""
    print(f"[ Ok  ] {message}")


# Directories to search
SEARCH_DIRS = [
    "apps",
    "crates",
    "packages",
    "plugins",
    "scripts",
    "e2e",
    "skills",
    "docs",
]

# File extensions to process
EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".rs",
    ".toml",
    ".json",
    ".yaml",
    ".yml",
    ".md",
    ".sh",
    ".swift",
    ".css",
    ".html",
    ".snap",
    ".mdx",
}

# Directories to skip entirely
SKIP_DIRS = {
    "target",
    "node_modules",
    ".git",
    ".cargo",
    ".mypy_cache",
    "dist",
    ".system_generated",
    ".gemini",
}

# Files to skip entirely
SKIP_FILES = {"Cargo.lock", "pnpm-lock.yaml", "rebrand_sweep.py"}

# Substring patterns in absolute paths to skip (e.g. historical docs and changelogs)
SKIP_PATH_PATTERNS = [
    "docs/FORK_PLAN.md",
    "docs/COMMERCIAL_FEATURES.md",
    "docs/_REMOVED_AUTH.md",
    "docs/code_review.md",
    "packages/changelog/content",
]

REPLACEMENTS = [
    ("@hypr/", "@meetspace/"),
    ("com.hyprnote", "com.meetspace"),
    ("hypr-", "meetspace-"),
    ("hypr_", "meetspace_"),
    ("HYPR_", "MEETSPACE_"),
    ("hyprnote", "meetspace"),
    ("Hyprnote", "Meetspace"),
    ("HYPRNOTE", "MEETSPACE"),
    ("anarlog", "meetspace"),
    ("Anarlog", "Meetspace"),
    ("ANARLOG", "MEETSPACE"),
]


def should_skip(filepath):
    # Check filename in skip list
    filename = os.path.basename(filepath)
    if filename in SKIP_FILES:
        return True

    # Check path patterns
    normalized_path = filepath.replace("\\", "/")
    for pattern in SKIP_PATH_PATTERNS:
        if pattern in normalized_path:
            return True

    return False


# Root-level files the dir walk would otherwise miss (the workspace manifest
# uses hypr-* dependency keys that members reference as meetspace-*).
ROOT_FILES = ["Cargo.toml"]


def _rebrand_file(filepath, repo_root):
    """Apply REPLACEMENTS to one file. Returns occurrences replaced (0 if none)."""
    if should_skip(filepath):
        return 0
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        print_wrn(f"Failed to read file {filepath}: {e}")
        return 0

    new_content = content
    replaced = 0
    for old_val, new_val in REPLACEMENTS:
        if old_val in new_content:
            replaced += new_content.count(old_val)
            new_content = new_content.replace(old_val, new_val)

    # Detect empty headers and remove them. Configure Providers is the only one.
    normalized_path = filepath.replace("\\", "/")
    if "settings/ai/stt/configure.tsx" in normalized_path:
        pattern = r"<h3[^>]*>\s*(?:<Trans[^>]*>\s*)?Configure Providers\s*(?:</Trans>\s*)?</h3>\n?"
        new_content, count = re.subn(pattern, "", new_content, flags=re.IGNORECASE)
        if count > 0:
            replaced += count
            print_info(
                f"Removed {count} empty header(s) from "
                f"{os.path.relpath(filepath, repo_root)}"
            )

    if replaced:
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print_info(
                f"Rebranded {replaced} occurrences in "
                f"{os.path.relpath(filepath, repo_root)}"
            )
        except Exception as e:
            print_err(f"Failed to write file {filepath}: {e}")
            return 0
    return replaced


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print_info(f"Starting rebranding sweep in repository root: {repo_root}")

    count_files = 0
    count_replacements = 0

    targets = []
    for search_dir in SEARCH_DIRS:
        dir_path = os.path.join(repo_root, search_dir)
        if not os.path.exists(dir_path):
            continue
        for root, dirs, files in os.walk(dir_path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for file in files:
                if os.path.splitext(file)[1].lower() in EXTENSIONS:
                    targets.append(os.path.join(root, file))
    for rf in ROOT_FILES:
        p = os.path.join(repo_root, rf)
        if os.path.exists(p):
            targets.append(p)

    for filepath in targets:
        n = _rebrand_file(filepath, repo_root)
        if n:
            count_files += 1
            count_replacements += n

    print_ok(
        f"Rebranding sweep finished! Updated {count_replacements} occurrences in {count_files} files."
    )


if __name__ == "__main__":
    main()
