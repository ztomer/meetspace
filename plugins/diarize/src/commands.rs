use crate::pipeline::{diarize_file, SpeakerTurn};

#[tauri::command]
#[specta::specta]
pub(crate) async fn diarize_audio(
    audio_path: String,
) -> std::result::Result<Vec<SpeakerTurn>, String> {
    // pyannote-local is sync + CPU-bound; offload so we don't block the Tauri
    // command runtime. spawn_blocking handles both the file IO and the ORT
    // inference.
    let path = audio_path.clone();
    tokio::task::spawn_blocking(move || diarize_file(&path))
        .await
        .map_err(|e| format!("diarize task panicked: {e}"))?
        .map_err(|e| e.to_string())
}
