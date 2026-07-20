use crate::types::{Collection, EnhancedNote, ImportStats, Session};
use std::path::{Path, PathBuf};

const SUPPORTED_EXTENSIONS: &[&str] = &["txt", "md", "markdown", "html", "htm", "csv", "json"];

fn is_supported(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()),
        None => false,
    }
}

fn slugify(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled")
        .to_string()
}

fn read_text(path: &Path) -> Option<String> {
    match std::fs::read_to_string(path) {
        Ok(content) => Some(content),
        Err(_) => None,
    }
}

/// Walk a Google Takeout "Google Drive" export folder and map each supported
/// file to an `EnhancedNote` under its own `Session`. Unsupported/binary files
/// (`.pdf`, `.docx`, `.gdoc`/`.gsheet` stubs) are skipped and counted.
pub fn import_all_from_path(path: &Path) -> Result<Collection, crate::Error> {
    let (sessions, enhanced_notes, skipped) = walk_export(path)?;

    if sessions.is_empty() {
        return Err(crate::Error::InvalidData(format!(
            "No importable Google Drive files found in '{}'. \
             Export a Google Takeout 'Google Drive' folder and point the \
             importer at it (PDF/DOCX are not yet supported).",
            path.display()
        )));
    }

    log::debug!(
        "gdrive import: {} notes, {} sessions, {} files skipped",
        enhanced_notes.len(),
        sessions.len(),
        skipped
    );

    Ok(Collection {
        sessions,
        enhanced_notes,
        transcripts: Vec::new(),
        humans: Vec::new(),
        organizations: Vec::new(),
        participants: Vec::new(),
        templates: Vec::new(),
        tags: Vec::new(),
        tag_mappings: Vec::new(),
    })
}

pub fn import_stats_from_path(path: &Path) -> Result<ImportStats, crate::Error> {
    let data = import_all_from_path(path)?;
    Ok(ImportStats::from_data(&data))
}

fn walk_export(root: &Path) -> Result<(Vec<Session>, Vec<EnhancedNote>, usize), crate::Error> {
    if !root.exists() {
        return Err(crate::Error::InvalidData(format!(
            "Google Drive export path does not exist: '{}'",
            root.display()
        )));
    }
    if !root.is_dir() {
        return Err(crate::Error::InvalidData(format!(
            "Google Drive export path is not a folder: '{}'",
            root.display()
        )));
    }

    let mut sessions = Vec::new();
    let mut enhanced_notes = Vec::new();
    let mut skipped: usize = 0;

    let mut entries: Vec<PathBuf> = Vec::new();
    collect_files(root, &mut entries)?;
    entries.sort();

    let created_at = now_rfc3339();

    for file in entries {
        if !is_supported(&file) {
            skipped += 1;
            continue;
        }
        let content = match read_text(&file) {
            Some(c) if !c.trim().is_empty() => c,
            _ => {
                skipped += 1;
                continue;
            }
        };

        let session_id = format!("gdrive-{}", slugify(&file));
        let title = slugify(&file);

        sessions.push(Session {
            id: session_id.clone(),
            user_id: String::new(),
            created_at: created_at.clone(),
            title,
            raw_md: Some(content.clone()),
            enhanced_content: None,
            folder_id: None,
            event_id: None,
        });

        enhanced_notes.push(EnhancedNote {
            id: format!("enhanced-{}", session_id),
            user_id: String::new(),
            session_id,
            content,
            template_id: None,
            position: 1,
            title: String::new(),
        });
    }

    Ok((sessions, enhanced_notes, skipped))
}

fn collect_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), crate::Error> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, out)?;
        } else if path.is_file() {
            out.push(path);
        }
    }
    Ok(())
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_file(dir: &Path, name: &str, content: &str) {
        let path = dir.join(name);
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn imports_supported_text_files_as_notes() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        write_file(root, "notes.txt", "hello world");
        write_file(root, "plan.md", "# Plan\n\nsteps");
        write_file(root, "data.csv", "a,b\n1,2");
        // binary/unsupported -> skipped
        write_file(root, "scan.pdf", "%PDF-1.4 fake");
        write_file(
            root,
            "doc.gdoc",
            "{\"url\":\"https://docs.google.com/...\"}",
        );

        let data = import_all_from_path(root).unwrap();
        assert_eq!(data.sessions.len(), 3);
        assert_eq!(data.enhanced_notes.len(), 3);
        assert!(
            data.enhanced_notes
                .iter()
                .any(|n| n.content.contains("hello world"))
        );
    }

    #[test]
    fn errors_when_folder_has_no_supported_files() {
        let tmp = tempfile::tempdir().unwrap();
        write_file(tmp.path(), "only.pdf", "%PDF fake");
        assert!(import_all_from_path(tmp.path()).is_err());
    }

    #[test]
    fn errors_on_missing_path() {
        let missing = std::env::temp_dir().join("does-not-exist-gdrive-xyz");
        assert!(import_all_from_path(&missing).is_err());
    }
}
