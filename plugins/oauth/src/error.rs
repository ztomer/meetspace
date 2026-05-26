use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("http: {0}")]
    Http(#[from] reqwest::Error),

    #[error("invalid auth response: {0}")]
    InvalidResponse(String),

    #[error("user cancelled or timed out")]
    Cancelled,

    #[error("provider returned error: {0}")]
    ProviderError(String),

    #[error("crypto: {0}")]
    Crypto(String),

    #[error("url parse: {0}")]
    Url(#[from] url::ParseError),
}

pub type Result<T> = std::result::Result<T, Error>;

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
