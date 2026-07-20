# Bug: STT model downloads fail (HTTP 403 from S3)

**Severity:** High — blocks local transcription for all non-Soniqo models.
**Status:** Root-caused, fix applied to source (needs verification + push).

## Symptom
Clicking "Download" on Whisper Large V3, Parakeet V2/V3, or any GGML Whisper
model fails immediately with a network error. Soniqo models (downloaded via
native macOS Swift FFI, not S3) are unaffected.

## Root cause
The fork's rebrand sweep (`scripts/rebrand_sweep.py`) rewrote every
`hyprnote.s3.us-east-1.amazonaws.com` URL to `meetspace.s3.us-east-1.amazonaws.com`
across the model-download code. The `meetspace` S3 bucket does **not** exist /
is not public, so every model URL returns **403 Forbidden**.

Confirmed by `curl -sI`:
- `meetspace.s3.us-east-1.amazonaws.com/...` → 403 (all 13 model URLs)
- `hyprnote.s3.us-east-1.amazonaws.com/v0/openai_whisper-large-v3-v20240930_626MB.tar` → 200 (626 MB)
- `hyprnote.s3.us-east-1.amazonaws.com/v0/ggerganov/whisper.cpp/main/ggml-small-q8_0.bin` → 200

The download pipeline (`crates/model-downloader`) has no auth/signing, so it
cannot recover — the bare reqwest GET just surfaces the 403 as
"Resource not found or inaccessible".

## Affected files
- `crates/am/src/model.rs` — `tar_url()` (Parakeet V2/V3, Whisper Large V3)
- `crates/whisper-local-model/src/lib.rs` — `model_url()` (GGML variants)
- `crates/local-model/src/lib.rs` — `model_url()` (GGUF LLM models)

## Fix applied
Reverted all 13 URLs `meetspace.s3...` → `hyprnote.s3...`, including the
`yujonglee/hypr-llm-sm` key in `crates/local-model/src/lib.rs` (matches
upstream `desktop_v1.3.1`). `cargo check` + `pnpm -F desktop typecheck` green.

**Script-level fix (prevents rebase re-introduction):** `scripts/rebrand_sweep.py`
now carries a `PROTECTED_RESTORE` list that runs *after* the REPLACEMENTS and
restores `meetspace.s3.us-east-1.amazonaws.com` → `hyprnote.s3...` (and
`yujonglee/meetspace-llm-sm` → `yujonglee/hypr-llm-sm`). Future `rebase-on-main.sh`
/ `sync-upstream.sh` runs rebrand without corrupting model URLs.

## Caveat (separate upstream issue)
`ggml-large-v3-turbo-q8_0.bin` also returns 403 on the **hyprnote** bucket, so
the Whisper Large Turbo (whisper-cpp) variant is broken upstream too. Not in
scope here — only Whisper Large V3 (Argmax/MLX) was reported.

## Verification
1. `pnpm smoke` to confirm app boots.
2. Spot-check a download in-app: Settings → AI → STT → Whisper Large V3 → Download.
3. Optionally `curl -sI` each fixed URL → expect 200.
