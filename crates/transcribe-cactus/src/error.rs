const UNSUPPORTED_WEBSOCKET_TEXT_PAYLOAD: &str = "unsupported websocket text payload";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Cactus(#[from] meetspace_cactus::Error),

    #[error(transparent)]
    Audio(#[from] meetspace_audio_utils::Error),

    #[error(transparent)]
    Chunking(#[from] meetspace_audio_chunking::Error),

    #[error("{message}")]
    Protocol { message: String },
}

impl Error {
    pub(crate) fn protocol(message: impl Into<String>) -> Self {
        Self::Protocol {
            message: message.into(),
        }
    }

    pub(crate) fn unsupported_websocket_text_payload() -> Self {
        Self::protocol(UNSUPPORTED_WEBSOCKET_TEXT_PAYLOAD)
    }
}
