#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Cactus(#[from] meetspace_cactus::Error),
    #[error(transparent)]
    Manager(#[from] meetspace_model_manager::Error),
}
