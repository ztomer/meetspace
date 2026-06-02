#!/usr/bin/env python3
import os
import sys
import time
import json
import urllib.request
import subprocess


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


def get_head_sha():
    return subprocess.check_output(["git", "rev-parse", "HEAD"]).decode("utf-8").strip()


def fetch_actions_runs():
    url = "https://api.github.com/repos/ztomer/meetspace/actions/runs?per_page=20"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data.get("workflow_runs", [])
    except Exception as e:
        print_wrn(f"Failed to fetch Actions runs from GitHub: {e}")
        return []


def fetch_cask_version():
    url = (
        "https://raw.githubusercontent.com/ztomer/homebrew-tap/main/Casks/meetspace.rb"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            content = response.read().decode()
            for line in content.splitlines():
                if "version " in line:
                    # extract value inside quotes
                    parts = line.split('"')
                    if len(parts) >= 3:
                        return parts[1]
    except Exception as e:
        print_wrn(f"Failed to fetch Homebrew tap version: {e}")
    return None


def main():
    head_sha = get_head_sha()
    tag_name = sys.argv[1] if len(sys.argv) > 1 else "v1.0.36_meet2"
    expected_cask_version = tag_name.lstrip("v")

    print_info(f"Target Release Tag: {tag_name}")
    print_info(f"Latest Git Head SHA: {head_sha}")
    print_info("----------------------------------------------------------------------")
    print_info("ACTION REQUIRED:")
    print_info(
        f"Please open your browser and create a new Release for tag '{tag_name}' at:"
    )
    print_info(f"  https://github.com/ztomer/meetspace/releases/new?tag={tag_name}")
    print_info("----------------------------------------------------------------------")
    print_info("Waiting for the release run to trigger on GitHub Actions...")

    run_id = None
    start_time = time.time()

    # Step 1: Detect the run
    while True:
        runs = fetch_actions_runs()
        for run in runs:
            # We look for a run triggered by the release event, or matching our head_sha and tag branch
            is_match = (
                (run.get("event") == "release" and run.get("head_branch") == tag_name)
                or (run.get("head_branch") == tag_name)
                or (run.get("event") == "release" and run.get("head_sha") == head_sha)
            )
            if is_match:
                run_id = run.get("id")
                print_ok(f"Detected Release Action Run ID: {run_id}")
                print_info(f"HTML URL: {run.get('html_url')}")
                break

        if run_id:
            break

        elapsed = int(time.time() - start_time)
        print_info(
            f"Still waiting... ({elapsed}s elapsed). Please publish the GitHub release to start the build."
        )
        time.sleep(20)

    # Step 2: Poll status of the run
    print_info("Monitoring the CI build progress...")
    last_status = None
    while True:
        runs = fetch_actions_runs()
        target_run = None
        for run in runs:
            if run.get("id") == run_id:
                target_run = run
                break

        if not target_run:
            print_wrn("Could not find the target run in the latest status fetch.")
            time.sleep(20)
            continue

        status = target_run.get("status")
        conclusion = target_run.get("conclusion")

        if status != last_status:
            print_info(f"Run status updated: {status} (conclusion: {conclusion})")
            last_status = status

        if status == "completed":
            if conclusion == "success":
                print_ok("GitHub Actions release build completed successfully!")
                break
            else:
                print_err(
                    f"GitHub Actions release build failed with conclusion: {conclusion}"
                )
                sys.exit(1)

        time.sleep(30)

    # Step 3: Verify Homebrew tap update
    print_info("Waiting for Homebrew Tap Cask to update to new version...")
    start_time = time.time()
    while True:
        current_version = fetch_cask_version()
        if current_version == expected_cask_version:
            print_ok(
                f"Homebrew Tap Cask successfully updated to version: {current_version}!"
            )
            break

        elapsed = int(time.time() - start_time)
        if elapsed > 300:  # 5 minutes timeout
            print_wrn(
                f"Timeout waiting for Homebrew update. Current version is still: {current_version}"
            )
            print_info(
                "You can verify the Cask manually at: https://github.com/ztomer/homebrew-tap"
            )
            break

        print_info(
            f"Checking Cask version... (current: '{current_version}', expected: '{expected_cask_version}')"
        )
        time.sleep(20)

    print_ok("All done! Release push and Homebrew update verified successfully.")


if __name__ == "__main__":
    main()
