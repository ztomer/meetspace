#!/usr/bin/env python3
"""
theme_sweep.py — Replace hardcoded Tailwind color classes with semantic theme tokens.

Usage:
  python3 scripts/theme_sweep.py            # dry-run (preview only)
  python3 scripts/theme_sweep.py --write    # apply changes in-place

The script replaces concrete color classes (stone-*, neutral-*, etc.) in TSX/TS/CSS
files with the centralised semantic tokens declared in globals.css / tailwind @theme.

Lines containing "# @theme-keep" or "// @theme-keep" are skipped entirely.
Lines containing "# @theme-partial-keep" or "// @theme-partial-keep" will only
have safe/unambiguous mappings applied.

Rules are applied in order; the FIRST matching rule wins for each token on a line.
"""

import os
import re
import sys
from dataclasses import dataclass


def print_info(message):
    print(f"[ ==> ] {message}")


def print_wrn(message):
    print(f"[ Wrn ] {message}")


def print_err(message):
    print(f"[ Err ] {message}")


def print_ok(message):
    print(f"[ Ok  ] {message}")


# ---------------------------------------------------------------------------
# Mapping table
# Each entry: (regex_pattern, replacement, comment_explaining_why)
#
# Order matters — more specific patterns should come before general ones.
# Within a line every pattern is tried independently (not mutually exclusive),
# so overlapping patterns should be avoided.
# ---------------------------------------------------------------------------


@dataclass
class Rule:
    pattern: str
    replacement: str
    note: str
    safe: bool = True  # safe=False → only applied when not @theme-partial-keep
    compiled: re.Pattern = None

    def __post_init__(self):
        self.compiled = re.compile(r"(?<![a-z-])" + self.pattern + r"(?![a-z0-9-/])")


RULES: list[Rule] = [
    # -----------------------------------------------------------------------
    # PANELS / BACKGROUNDS — absolute colours used in card/popover contexts
    # These only fire when paired with dark: overrides in same class string.
    # Use @theme-keep to suppress on intentional inverse-colour patterns.
    # -----------------------------------------------------------------------
    Rule(
        r"bg-white",
        "bg-popover",
        "bg-white inside card/popover should use semantic bg-popover",
        safe=False,
    ),
    # -----------------------------------------------------------------------
    # GRADIENT stones (update button)
    # -----------------------------------------------------------------------
    Rule(r"from-stone-600", "from-primary/80", "stone-600 gradient start → primary"),
    Rule(r"to-stone-500", "to-primary/70", "stone-500 gradient end → primary"),
    Rule(
        r"hover:from-stone-500",
        "hover:from-primary/70",
        "stone-500 hover gradient start",
    ),
    Rule(r"hover:to-stone-400", "hover:to-primary/60", "stone-400 hover gradient end"),
    # -----------------------------------------------------------------------
    # BORDERS
    # -----------------------------------------------------------------------
    Rule(
        r"border-neutral-200",
        "border-border",
        "neutral-200 is the default border colour in light mode",
    ),
    Rule(
        r"border-stone-200",
        "border-border",
        "stone-200 is the default border colour in light mode",
    ),
    Rule(
        r"dark:border-stone-800",
        "dark:border-border",
        "stone-800 matches --border in dark mode",
    ),
    Rule(
        r"dark:border-stone-850",
        "dark:border-border",
        "stone-850 (custom) is effectively --border in dark mode",
    ),
    Rule(r"border-stone-400", "border-border", "stone-400 used as a mid-weight border"),
    # -----------------------------------------------------------------------
    # TEXT — foreground / body copy
    # -----------------------------------------------------------------------
    Rule(
        r"text-neutral-900",
        "text-foreground",
        "neutral-900 is highest-contrast body text ≈ --foreground",
    ),
    Rule(
        r"text-stone-900",
        "text-foreground",
        "stone-900 is highest-contrast body text ≈ --foreground",
    ),
    Rule(
        r"text-neutral-800",
        "text-foreground",
        "neutral-800 is near-highest contrast body text",
    ),
    Rule(
        r"text-neutral-700",
        "text-foreground",
        "neutral-700 is standard body text weight",
    ),
    Rule(
        r"text-stone-700", "text-foreground", "stone-700 is standard body text weight"
    ),
    # -----------------------------------------------------------------------
    # TEXT — muted / secondary
    # -----------------------------------------------------------------------
    Rule(
        r"text-neutral-600",
        "text-muted-foreground",
        "neutral-600 is a muted/secondary text level",
    ),
    Rule(
        r"text-stone-600",
        "text-muted-foreground",
        "stone-600 is a muted/secondary text level",
    ),
    Rule(
        r"text-neutral-500",
        "text-muted-foreground",
        "neutral-500 is the canonical muted foreground",
    ),
    Rule(
        r"text-stone-500",
        "text-muted-foreground",
        "stone-500 is the canonical muted foreground",
    ),
    Rule(
        r"text-neutral-400",
        "text-muted-foreground",
        "neutral-400 is a dim/placeholder level",
    ),
    Rule(
        r"text-stone-400",
        "text-muted-foreground",
        "stone-400 is a dim/placeholder level",
    ),
    Rule(
        r"text-neutral-300",
        "text-muted-foreground/70",
        "neutral-300 is very dim, add opacity modifier",
    ),
    Rule(
        r"text-neutral-200",
        "text-muted-foreground/50",
        "neutral-200 is very dim, add opacity modifier",
    ),
    # hover variants for text
    Rule(
        r"hover:text-neutral-900",
        "hover:text-foreground",
        "hover target: primary text colour",
    ),
    Rule(
        r"hover:text-neutral-700",
        "hover:text-foreground",
        "hover target: primary text colour",
    ),
    Rule(
        r"hover:text-neutral-600",
        "hover:text-muted-foreground",
        "hover target: muted text colour",
    ),
    # dark-mode text overrides that already correctly invert
    Rule(
        r"dark:text-neutral-200",
        "dark:text-foreground",
        "dark:neutral-200 ≈ --foreground in dark mode",
    ),
    # -----------------------------------------------------------------------
    # BACKGROUNDS — base panels
    # -----------------------------------------------------------------------
    Rule(
        r"bg-neutral-50",
        "bg-muted",
        "neutral-50 is the light-mode panel / muted surface",
    ),
    Rule(
        r"bg-stone-50", "bg-muted", "stone-50 is the light-mode panel / muted surface"
    ),
    Rule(
        r"bg-neutral-100",
        "bg-accent",
        "neutral-100 is the light-mode accent/hover surface",
    ),
    Rule(
        r"bg-stone-100", "bg-accent", "stone-100 is the light-mode accent/hover surface"
    ),
    # with opacity modifiers
    Rule(
        r"bg-neutral-200/50",
        "bg-secondary/50",
        "neutral-200/50 is a secondary panel with opacity",
    ),
    Rule(
        r"bg-stone-200/50",
        "bg-secondary/50",
        "stone-200/50 is a secondary panel with opacity",
    ),
    Rule(
        r"bg-neutral-200/70",
        "bg-secondary/70",
        "neutral-200/70 is a secondary panel with opacity",
    ),
    Rule(
        r"bg-stone-200/70",
        "bg-secondary/70",
        "stone-200/70 is a secondary panel with opacity",
    ),
    # hover backgrounds
    Rule(
        r"hover:bg-neutral-100",
        "hover:bg-accent",
        "hover:neutral-100 is the standard row hover",
    ),
    Rule(
        r"hover:bg-stone-100",
        "hover:bg-accent",
        "hover:stone-100 is the standard row hover",
    ),
    Rule(
        r"hover:bg-neutral-200",
        "hover:bg-secondary",
        "hover:neutral-200 is a secondary hover",
    ),
    Rule(
        r"hover:bg-stone-200",
        "hover:bg-secondary",
        "hover:stone-200 is a secondary hover",
    ),
    # dark-mode background overrides
    Rule(
        r"dark:bg-stone-900/50",
        "dark:bg-card/50",
        "dark:stone-900/50 ≈ --card in dark mode with opacity",
    ),
    Rule(
        r"dark:bg-stone-900/70",
        "dark:bg-card/70",
        "dark:stone-900/70 ≈ --card in dark mode with opacity",
    ),
    Rule(
        r"dark:bg-stone-900\b", "dark:bg-card", "dark:stone-900 ≈ --card in dark mode"
    ),
    Rule(
        r"dark:hover:bg-stone-900/70",
        "dark:hover:bg-card/70",
        "dark hover on stone-900/70 → card",
    ),
    Rule(
        r"dark:hover:bg-stone-800",
        "dark:hover:bg-accent",
        "dark hover on stone-800 → accent",
    ),
    Rule(
        r"dark:hover:border-stone-800",
        "dark:hover:border-border",
        "dark hover border stone-800 → border token",
    ),
    Rule(
        r"dark:border-stone-800",
        "dark:border-border",
        "dark:stone-800 border ≈ --border",
    ),
    Rule(
        r"dark:focus:bg-stone-850",
        "dark:focus:bg-secondary",
        "dark focus bg on stone-850 → secondary",
    ),
    # focus backgrounds
    Rule(
        r"focus:bg-neutral-200",
        "focus:bg-secondary",
        "focus:neutral-200 ≈ secondary surface",
    ),
    # -----------------------------------------------------------------------
    # placeholder text
    # -----------------------------------------------------------------------
    Rule(
        r"placeholder:text-neutral-400",
        "placeholder:text-muted-foreground",
        "placeholder uses muted-foreground",
    ),
]

# ---------------------------------------------------------------------------
# Files / directories to process
# ---------------------------------------------------------------------------

TARGET_EXTENSIONS = {".tsx", ".ts", ".css"}

TARGET_DIRS = [
    "apps/desktop/src",
    "apps/web/src",
    "packages/ui/src",
]

# These globs will be excluded even if they match TARGET_DIRS
EXCLUDE_SUFFIXES = (
    ".test.tsx",
    ".test.ts",
    ".spec.tsx",
    ".spec.ts",
    ".d.ts",
)


def should_skip_file(path: str) -> bool:
    return any(path.endswith(s) for s in EXCLUDE_SUFFIXES)


def apply_rules_to_line(line: str, partial_only: bool) -> tuple[str, int]:
    """Apply all applicable rules to a single line. Returns (new_line, changes)."""
    changes = 0
    for rule in RULES:
        if not rule.safe and partial_only:
            continue
        new_line, n = rule.compiled.subn(rule.replacement, line)
        if n:
            changes += n
            line = new_line
    return line, changes


def process_file(file_path: str, dry_run: bool) -> int:
    """Process one file. Returns number of replacements made."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.splitlines(keepends=True)
    except (OSError, UnicodeDecodeError) as e:
        print_err(f"Cannot read {file_path}: {e}")
        return 0

    # File-level opt-out: if @theme-keep appears anywhere in the file,
    # skip the entire file (for files where every line is intentional).
    if "@theme-keep-file" in content:
        return 0

    new_lines = []
    total_replacements = 0
    prev_line_keep = False  # carry keep guard from comment lines above JSX attrs
    prev_line_partial = False

    for line in lines:
        stripped = line.rstrip()

        # Inherit keep from previous comment line (e.g. // @theme-keep above a JSX attr)
        is_keep = (
            "@theme-keep" in stripped and "@theme-partial-keep" not in stripped
        ) or prev_line_keep
        is_partial = "@theme-partial-keep" in stripped or prev_line_partial

        # Track whether THIS line is a standalone comment (carry to next line only)
        is_comment_line = stripped.lstrip().startswith(
            "//"
        ) or stripped.lstrip().startswith("#")
        if is_comment_line and (
            "@theme-keep" in stripped or "@theme-partial-keep" in stripped
        ):
            prev_line_keep = (
                "@theme-keep" in stripped and "@theme-partial-keep" not in stripped
            )
            prev_line_partial = "@theme-partial-keep" in stripped
        else:
            prev_line_keep = False
            prev_line_partial = False

        if is_keep:
            new_lines.append(line)
            continue

        new_line, n = apply_rules_to_line(line, partial_only=is_partial)
        total_replacements += n
        new_lines.append(new_line)

    if total_replacements == 0:
        return 0

    if not dry_run:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        except OSError as e:
            print_err(f"Cannot write {file_path}: {e}")
            return 0

    return total_replacements


def run_sweep(root: str, dry_run: bool = True) -> None:
    total_files = 0
    total_replacements = 0
    changed_files: list[tuple[str, int]] = []

    for target_dir in TARGET_DIRS:
        abs_dir = os.path.join(root, target_dir)
        if not os.path.isdir(abs_dir):
            print_wrn(f"Directory not found, skipping: {abs_dir}")
            continue

        for dirpath, _dirnames, filenames in os.walk(abs_dir):
            for filename in filenames:
                ext = os.path.splitext(filename)[1]
                if ext not in TARGET_EXTENSIONS:
                    continue

                abs_path = os.path.join(dirpath, filename)
                if should_skip_file(abs_path):
                    continue

                total_files += 1
                n = process_file(abs_path, dry_run)
                if n:
                    rel = os.path.relpath(abs_path, root)
                    changed_files.append((rel, n))
                    total_replacements += n

    mode = "DRY RUN — would modify" if dry_run else "Modified"

    print()
    for rel, n in sorted(changed_files):
        print_info(f"  {mode}: {rel}  ({n} replacement{'s' if n != 1 else ''})")

    print()
    if dry_run:
        print_ok(
            f"Dry run complete. {len(changed_files)} file(s) would change, "
            f"{total_replacements} total replacement(s)."
        )
        print_info("Run with --write to apply changes.")
    else:
        print_ok(
            f"Sweep complete. {len(changed_files)} file(s) changed, "
            f"{total_replacements} total replacement(s)."
        )
        print_info("Run `pnpm exec dprint fmt` to reformat the modified files.")


if __name__ == "__main__":
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write_mode = "--write" in sys.argv
    dry_run = not write_mode

    if dry_run:
        print_info("Theme sweep — DRY RUN (no files will be modified)")
    else:
        print_info("Theme sweep — WRITE MODE (files will be modified in-place)")

    run_sweep(repo_root, dry_run=dry_run)
