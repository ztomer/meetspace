<p align="center">
  <img src="apps/desktop/src-tauri/icons/src/meetspace-prod.png" alt="Meetspace Logo" width="160" style="border-radius: 20%;" />
</p>

# Meetspace

### **The local-first, premium AI meeting assistant that respects your privacy.**
No cloud sign-ups, no monthly subscriptions, and no remote servers eavesdropping on your conversations. Your audio, transcripts, notes, and keys never leave your machine.

---

## Why Meetspace?

*   🔒 **Absolute Privacy by Default** — 100% of your data stays exactly where it belongs: on your personal hardware. Offline-ready, tracker-free, and local-first.
*   🎙️ **State-of-the-Art Local Transcription** — Transcribe voice cleanly on-device using optimized models like Parakeet (realtime on Apple Silicon) or Faster Whisper Large.
*   🧠 **Bring Your Own Local LLM** — Power your meeting intelligence, summaries, and action items using local models via Ollama, LM Studio, Osaurus, or your own OpenAI-compatible endpoint.
*   ✍️ **Notes as Clean Markdown** — All your transcripts and notes are stored directly on your disk. Sync, grep, or edit them using iCloud, Dropbox, Syncthing, or Git. No proprietary formats or vendor lock-in.
*   🔌 **Privacy-First Integrations** — Deep filesystem writes directly to your **Obsidian** vault, or connect securely to **Notion** and **Linear** using your own private API keys.
*   📅 **Direct Calendar Sync** — Sync your agenda without a middleman. Google and Outlook connect via direct localhost PKCE OAuth; Apple Calendar binds directly through the macOS system bridge. Duplicate events from multiple providers are automatically deduped.
*   👥 **On-Device Speaker Identification** — Bundled Pyannote diarization clusters speakers locally, then uses your LLM to automatically resolve anonymized speakers against your meeting participants.
*   🎨 **Beautiful Interface** — Premium, high-contrast dark and light themes that seamlessly match your operating system theme.

---

## Getting Started

### 📦 Download the App
Simply download the latest `.dmg` installer from the [Meetspace GitHub Releases](https://github.com/ztomer/meetspace/releases) page and drag it to your Applications folder.

> [!NOTE]
> Since Meetspace releases are packaged locally and are unsigned, macOS Gatekeeper may display a warning on first launch. You can bypass this by holding Control while clicking the app and choosing **Open**.

---

## Technical & Development Guide

Meetspace is built using a modern local-first stack: **Tauri**, **Rust**, **TypeScript**, and **React**.

### 🛠️ Prerequisites
Before building from source, ensure you have the following installed on your machine:
- **Rust** (stable toolchain)
- **Node.js** & **pnpm** (`pnpm install` in the root)
- Xcode Command Line Tools (on macOS)

### 🚀 Running in Development Mode
Launch the React Vite frontend and Tauri desktop runtime together:
```bash
./scripts/run.sh
```
*Note: The first cold compile of the Tauri app will download and compile dependencies and can take up to 10 minutes. Subsequent launches are near-instant.*

### 🏗️ Compiling & Typechecking
Verify that the complete TypeScript workspace and Rust crates compile cleanly:
```bash
./scripts/build.sh
```

### 📦 Building a Release DMG
Compile the optimized production bundle and package it into a distributable installer:
```bash
./scripts/package.sh dmg
```
*The resulting installer lands under `apps/desktop/src-tauri/target/release/bundle/dmg/`.*

---

## Upstream Synchronization & Maintenance

Meetspace is maintained as a customized, fully local-first fork of the open-source **Anarlog** repository.

To automate rebasing downstream changes, force-pushing to your GitHub remote, and packaging release DMGs, run the unified synchronization script:
```bash
./scripts/rebase-push-release.sh [branch_name]
```
For detailed instructions, troubleshooting rebase subtree conflicts, and reviewing compile-time environment fallbacks, refer to the custom agent skill inside this repository: [rebase-and-release Skill](file:///.agents/skills/rebase-and-release/SKILL.md) and the rebase recipe in [docs/_REMOVED_AUTH.md](docs/_REMOVED_AUTH.md).

---

## Lineage & License

Meetspace is a fork of the open-source [Anarlog](https://github.com/fastrepl/anarlog) project (originally `hyprnote`). All cloud-dependencies, Stripe billing integrations, remote telemetry, and Supabase hooks have been completely decoupled. 

For the complete phased fork architecture roadmap, see [`docs/FORK_PLAN.md`](docs/FORK_PLAN.md).

Licensed under the **MIT License**. Original upstream copyrights (Fastrepl, Inc.) are preserved in full compliance with license terms. See [`LICENSE`](LICENSE) for details.
