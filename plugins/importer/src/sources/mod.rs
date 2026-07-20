mod as_is;
mod gdrive;
mod granola;
mod meetspace;

pub use as_is::AsIsData;

use crate::types::{Collection, ImportSource, ImportSourceInfo, ImportStats, TransformKind};

pub async fn import_all(source: &ImportSource) -> Result<Collection, crate::Error> {
    match source.transform {
        TransformKind::MeetspaceV0 => meetspace::v0::import_all_from_path(&source.path).await,
        TransformKind::Granola => granola::import_all_from_path(&source.path).await,
        TransformKind::AsIs => as_is::load_data(&source.path),
        TransformKind::GoogleDrive => gdrive::import_all_from_path(&source.path),
    }
}

pub async fn import_stats(source: &ImportSource) -> Result<ImportStats, crate::Error> {
    match source.transform {
        TransformKind::MeetspaceV0 => meetspace::v0::import_stats_from_path(&source.path).await,
        TransformKind::Granola | TransformKind::AsIs => {
            let data = import_all(source).await?;
            Ok(ImportStats::from_data(&data))
        }
        TransformKind::GoogleDrive => gdrive::import_stats_from_path(&source.path),
    }
}

pub fn all_sources() -> Vec<ImportSource> {
    [
        ImportSource::meetspace_stable(),
        ImportSource::meetspace_nightly(),
    ]
    .into_iter()
    .flatten()
    .collect()
}

pub fn list_available_sources() -> Vec<ImportSourceInfo> {
    all_sources()
        .into_iter()
        .filter(|s| s.is_available())
        .map(|s| s.info())
        .collect()
}
