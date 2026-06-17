#!/usr/bin/env python3
import os
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
SEARCH_DIRS = ["apps", "crates", "packages", "plugins", "scripts", "e2e"]

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


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print_info(f"Starting rebranding sweep in repository root: {repo_root}")

    count_files = 0
    count_replacements = 0

    for search_dir in SEARCH_DIRS:
        dir_path = os.path.join(repo_root, search_dir)
        if not os.path.exists(dir_path):
            continue

        for root, dirs, files in os.walk(dir_path):
            # Prune skipped directories in-place to avoid walking down them
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in EXTENSIONS:
                    continue

                filepath = os.path.join(root, file)
                if should_skip(filepath):
                    continue

                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except Exception as e:
                    print_wrn(f"Failed to read file {filepath}: {e}")
                    continue

                # Check if any replacement pattern matches
                has_match = False
                new_content = content
                file_replaced_count = 0

                for old_val, new_val in REPLACEMENTS:
                    if old_val in new_content:
                        occurrences = new_content.count(old_val)
                        new_content = new_content.replace(old_val, new_val)
                        file_replaced_count += occurrences
                        has_match = True

                if has_match:
                    try:
                        with open(filepath, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        rel_path = os.path.relpath(filepath, repo_root)
                        print_info(
                            Relbranded_msg
                            := f"Rebranded {file_replaced_count} occurrences in {rel_path}"
                        )
                        count_files += 1
                        count_replacements += file_replaced_count
                    except Exception as e:
                        print_err(f"Failed to write file {filepath}: {e}")

    print_ok(
        f"Rebranding sweep finished! Updated {count_replacements} occurrences in {count_files} files."
    )


if __name__ == "__main__":
    main()
