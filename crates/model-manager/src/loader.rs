use std::path::Path;

pub trait ModelLoader: Send + Sync + 'static {
    type Error: std::error::Error + Send + Sync + 'static;

    fn load(path: &Path) -> Result<Self, Self::Error>
    where
        Self: Sized;
}

#[cfg(feature = "cactus")]
impl ModelLoader for meetspace_cactus::Model {
    type Error = meetspace_cactus::Error;

    fn load(path: &Path) -> Result<Self, Self::Error> {
        meetspace_cactus::Model::new(path)
    }
}

#[cfg(feature = "whisper-local")]
impl ModelLoader for meetspace_whisper_local::LoadedWhisper {
    type Error = meetspace_whisper_local::Error;

    fn load(path: &Path) -> Result<Self, Self::Error> {
        meetspace_whisper_local::LoadedWhisper::builder()
            .model_path(path.to_string_lossy().into_owned())
            .build()
    }
}
