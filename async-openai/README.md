<p align="center">
  <img src="apps/desktop/src-tauri/icons/src/meetspace-prod.png" alt="Meetspace" width="200" />
</p>

# Meetspace

A local-only AI meeting notetaker. Your audio, transcripts, and notes never leave your machine.

- **On-device transcription.** Parakeet, Whisper Large, or any of the local Whisper variants — runs entirely on your hardware.
- **Bring your own LLM.** Osaurus (default, `localhost:1337`), Ollama, LM Studio, or any OpenAI-compatible endpoint.
- **Notes as markdown on disk.** `cat` them, grep them, sync via Dropbox / iCloud / Syncthing / git. No cloud, no accounts, no tracking.
- **Integrations that respect locality.** Obsidian (write to your vault), Notion (your token), Linear (your key). OAuth-only services are deliberately out of scope.
- **Calendars without a middleman.** Google and Outlook via localhost OAuth (PKCE); tokens stay on this device. Apple Calendar through the system bridge. Same meeting showing up from multiple providers gets deduped automatically — pick the winner in Settings → Integrations → Calendar source precedence.
- **Speaker diarization on-device.** Pyannote segmentation + ECAPA embeddings bundled in the binary tag each turn after the meeting ends. When an LLM is configured, anonymous "Speaker 2" labels are resolved against the meeting's participant roster automatically.
- **Light and dark mode.** Theme toggle in Settings → App → Appearance; follows your OS by default.

## Run it

```bash
./scripts/run.sh        # launch in dev mode (vite + tauri)
./scripts/build.sh      # install + typecheck + cargo check + vite bundle
./scripts/package.sh    # produce .dmg / .app / .deb / .msi
```

First cold start of `run.sh` takes ~10 minutes because cargo compiles the full Tauri + Rust dependency tree. JS/TS hot-reloads after that.

Binaries are unsigned — Gatekeeper will warn on first launch unless you configure signing yourself.

## What's local-only

Everything. There is no Meetspace cloud, no signup, no billing, no telemetry beyond what your chosen LLM provider sees.

The picker for STT and LLM only offers providers that run on your machine, plus a "Custom (OpenAI-compatible)" escape hatch you can point at any HTTP endpoint (your own proxy, a cloud provider, whatever — Meetspace doesn't care).

## Lineage

Meetspace is a fork of the open-source [Anarlog](https://github.com/fastrepl/anarlog) project (originally `hyprnote`), with all cloud / Pro / billing / OAuth surface removed and a centralized theming layer added. See [`docs/FORK_PLAN.md`](docs/FORK_PLAN.md) for the phased rewrite and [`docs/COMMERCIAL_FEATURES.md`](docs/COMMERCIAL_FEATURES.md) for the upstream feature inventory.

## License

MIT. See [`LICENSE`](LICENSE). Original upstream copyright (Fastrepl, Inc.) is preserved per MIT terms.
