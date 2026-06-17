use base64::Engine;
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};

/// A PKCE code pair. The `verifier` stays on the device; the `challenge`
/// (sha256 + base64url, no padding) is sent to the authorization endpoint
/// in the initial redirect, and the verifier is sent later at token-exchange
/// time as proof that the same client started the flow.
#[derive(Debug, Clone)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

impl Pkce {
    pub fn new() -> Result<Self> {
        // RFC 7636: verifier is 43-128 chars of [A-Z / a-z / 0-9 / - / . / _ / ~].
        // Use 32 random bytes -> base64url with no padding = 43 chars.
        let mut bytes = [0u8; 32];
        getrandom::getrandom(&mut bytes).map_err(|e| Error::Crypto(e.to_string()))?;
        let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);

        let mut hasher = Sha256::new();
        hasher.update(verifier.as_bytes());
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize());

        Ok(Self {
            verifier,
            challenge,
        })
    }
}
