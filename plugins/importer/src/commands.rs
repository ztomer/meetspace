use crate::ext::ImporterPluginExt;
use crate::types::{
    ImportDataResult, ImportSource, ImportSourceInfo, ImportSourceKind, ImportStats,
};

#[tauri::command]
#[specta::specta]
pub async fn list_available_sources<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Vec<ImportSourceInfo>, String> {
    let sources = app.importer().list_available_sources();
    Ok(sources)
}

#[tauri::command]
#[specta::specta]
pub async fn run_import<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    source: ImportSourceKind,
    user_id: String,
) -> Result<ImportDataResult, String> {
    app.importer()
        .run_import(source, user_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn run_import_dry<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    source: ImportSourceKind,
) -> Result<ImportStats, String> {
    app.importer()
        .run_import_dry(source)
        .await
        .map_err(|e| e.to_string())
}

/// Import a source that needs a user-provided path (e.g. Google Drive Takeout
/// export). Falls back to the fixed-path source for non-path kinds.
#[tauri::command]
#[specta::specta]
pub async fn run_import_with_path<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    source: ImportSourceKind,
    path: Option<String>,
    user_id: String,
) -> Result<ImportDataResult, String> {
    let import_source: ImportSource = match (&source, path) {
        (ImportSourceKind::GoogleDrive, Some(p)) => ImportSource::google_drive(p.into()),
        _ => ImportSource::from(source.clone()),
    };
    app.importer()
        .run_import_from_source(&import_source, user_id)
        .await
        .map_err(|e| e.to_string())
}
