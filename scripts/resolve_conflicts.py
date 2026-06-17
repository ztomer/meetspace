#!/usr/bin/env python3
import subprocess
import os
import sys
import fnmatch

def print_info(message):
    print(f"[ ==> ] {message}")

def print_wrn(message):
    print(f"[ Wrn ] {message}")

def print_err(message):
    print(f"[ Err ] {message}")

def print_ok(message):
    print(f"[ Ok  ] {message}")

# Directories, files, and globs to keep deleted
REMOVED_DIRS = [
    "apps/api",
    "apps/stripe",
    "apps/web",
    "supabase",
    "packages/supabase",
    "packages/pricing",
    "apps/desktop/src/billing",
    "apps/desktop/src/onboarding/account",
    ".github/scripts",
    ".github/reports",
    ".github/workflows",
    "scripts/s3",
    "crates/cactus",
    "crates/cactus-model",
    "crates/llm-cactus",
    "crates/transcribe-cactus",
]

REMOVED_FILES = [
    "apps/desktop/src/auth/client.ts",
    "apps/desktop/src/auth/errors.ts",
    "apps/desktop/src/shared/config/configure-paid-settings.ts",
    "apps/desktop/src/stt/useUploadAudio.ts",
    "apps/desktop/src/settings/general/account.tsx",
    "apps/desktop/src/sidebar/profile/auth.tsx",
    ".infisical.json",
    "doxxer.api.toml",
    "doxxer.cli.toml",
    "doxxer.stripe.toml",
    "doxxer.web.toml",
    "openstatus.lock",
    "openstatus.yaml",
    "render.yaml",
    "bitrise.yml",
    "apps/desktop/src/settings/integrations.tsx",
    "apps/desktop/src/settings/shared.tsx",
    "scripts/download_releases.sh",
    ".github/AGENTS.md",
    "plugins/local-llm/src/resource.rs",
    "plugins/local-stt/src/server/internal2.rs",
    "crates/owhisper-client/src/adapter/cactus/batch.rs",
    "crates/owhisper-client/src/adapter/cactus/live.rs",
    "crates/owhisper-client/src/adapter/cactus/mod.rs",
    "crates/owhisper-client/src/adapter/cactus/retry.rs",
    "crates/vad/src/silero_cactus.rs",
]

REMOVED_GLOBS = [
    "packages/changelog/content/1.*.md",
    "packages/changelog/content/0.0.*.md",
]

def run_command(cmd):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return res.returncode, res.stdout.strip(), res.stderr.strip()

def should_delete(filepath):
    # Check removed files
    if filepath in REMOVED_FILES:
        return True
    
    # Check removed directories
    for d in REMOVED_DIRS:
        if filepath.startswith(d + "/"):
            return True
            
    # Check removed globs
    for pattern in REMOVED_GLOBS:
        if fnmatch.fnmatch(filepath, pattern):
            return True
            
    return False

REPLACEMENTS = [
    ("__" + "MEETSPACE_NAVIGATE__", "__MEETSPACE_NAVIGATE__"),
    ("com." + "meetspace", "com.meetspace"),
    ("@" + "meetspace/", "@meetspace/"),
    ("meetspace-", "meetspace-"),
    ("meetspace_", "meetspace_"),
    ("MEETSPACE_", "MEETSPACE_"),
    ("Hypr" + "note", "Meetspace"),
    ("meetspace" + "note", "meetspace"),
    ("MEETSPACE" + "NOTE", "MEETSPACE"),
    ("Anar" + "log", "Meetspace"),
    ("anar" + "log", "meetspace"),
    ("ANAR" + "LOG", "MEETSPACE"),
    ("meetspace", "meetspace"),
    ("MEETSPACE", "MEETSPACE"),
]

def is_rebrand_commit():
    code, stdout, stderr = run_command("git log -1 REBASE_HEAD")
    if code == 0:
        lines = stdout.splitlines()
        # Find commit subject (typically 5th line in git log)
        for line in lines[4:8]:
            l = line.lower()
            if "rebrand" in l or "rename" in l or "purge" in l:
                return True
    return False

def apply_rebrand_renames(filepath):
    # First checkout our base version of the file
    print_info(f"Checking out HEAD version of {filepath}...")
    checkout_code, checkout_out, checkout_err = run_command(f"git checkout --ours -- {filepath}")
    if checkout_code != 0:
        print_err(f"Failed to check out {filepath}: {checkout_err}")
        return False
        
    # Read the file
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print_err(f"Failed to read {filepath}: {e}")
        return False
        
    # Perform string replacements
    new_content = content
    for old, new in REPLACEMENTS:
        new_content = new_content.replace(old, new)
        
    # Write it back
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
    except Exception as e:
        print_err(f"Failed to write {filepath}: {e}")
        return False
        
    # Stage the file
    add_code, add_out, add_err = run_command(f"git add {filepath}")
    if add_code != 0:
        print_err(f"Failed to git add {filepath}: {add_err}")
        return False
        
    print_ok(f"Auto-rebranded and staged {filepath}")
    return True

def resolve():
    print_info("Analyzing git conflicts...")
    code, stdout, stderr = run_command("git status --porcelain")
    if code != 0:
        print_err(f"Failed to get git status: {stderr}")
        return False
        
    lines = stdout.splitlines()
    resolved_any = False
    unresolved_count = 0
    rebrand = is_rebrand_commit()
    
    if rebrand:
        print_info("Detected rebranding/rename commit! Activating auto-rebrand conflict resolver.")
        
    for line in lines:
        if len(line) < 4:
            continue
        status = line[:2]
        filepath = line[3:]
        
        # Conflict status codes in git:
        # DD: both deleted
        # AU: added by us
        # UD: deleted by them (modified by us)
        # UA: added by them
        # DU: deleted by us (modified by them)
        # AA: both added
        # UU: both modified
        if status in ["UD", "DU", "DD"]:
            if should_delete(filepath):
                print_info(f"Auto-resolving modify/delete conflict (keeping deleted): {filepath}")
                rm_code, rm_out, rm_err = run_command(f"git rm {filepath}")
                if rm_code == 0:
                    print_ok(f"Removed {filepath}")
                    resolved_any = True
                else:
                    print_err(f"Failed to run git rm on {filepath}: {rm_err}")
                    unresolved_count += 1
            else:
                print_wrn(f"Conflict on {filepath} ({status}) is not on the auto-delete list. Skipping.")
                unresolved_count += 1
        elif status in ["UU", "AA", "AU", "UA"]:
            if rebrand:
                if apply_rebrand_renames(filepath):
                    resolved_any = True
                else:
                    unresolved_count += 1
            else:
                # These are content conflicts or additions
                print_wrn(f"Content conflict on {filepath} ({status}). Requires manual resolution.")
                unresolved_count += 1
            
    if resolved_any:
        print_ok("Conflicts resolved and staged successfully.")
        
    if unresolved_count > 0:
        print_wrn(f"There are still {unresolved_count} unresolved conflicts.")
    else:
        print_ok("All conflicts resolved!")
        
    return True

if __name__ == "__main__":
    resolve()
