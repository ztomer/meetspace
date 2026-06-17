#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    HyprFileError(#[from] meetspace_file::Error),
    #[error(transparent)]
    IoError(#[from] std::io::Error),
    #[error(transparent)]
    LmStudioError(#[from] meetspace_lmstudio::Error),
    #[error("Model not downloaded")]
    ModelNotDownloaded,
    #[error("Other error: {0}")]
    Other(String),
}
