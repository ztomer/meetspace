use std::collections::HashMap;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tokio::time::Duration;
use url::Url;

use tauri_plugin_opener2::Opener2PluginExt;

use crate::error::Error;
use crate::pkce::Pkce;
use crate::server::listen_for_callback;

#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartPkceFlowArgs {
    /// e.g. `"google"` or `"outlook"` — used only for tracing.
    pub provider: String,
    /// OAuth 2.0 client id (public; no secret). The user registers it
    /// once with the provider (Google Cloud / Azure portal).
    pub client_id: String,
    /// Space-delimited scopes (provider-specific).
    pub scopes: String,
    /// Authorize endpoint URL, e.g. `https://accounts.google.com/o/oauth2/v2/auth`.
    pub authorize_url: String,
    /// Token endpoint URL, e.g. `https://oauth2.googleapis.com/token`.
    pub token_url: String,
    /// Optional extra params to append to the authorize URL
    /// (Google needs `access_type=offline&prompt=consent` to issue a refresh token).
    #[serde(default)]
    pub extra_authorize_params: HashMap<String, String>,
    /// Wait at most this many seconds for the user to complete the flow.
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u64,
}

fn default_timeout() -> u64 {
    180
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PkceTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub(crate) async fn start_pkce_flow<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    args: StartPkceFlowArgs,
) -> std::result::Result<PkceTokens, String> {
    run_flow(app, args).await.map_err(|e| e.to_string())
}

async fn run_flow<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    args: StartPkceFlowArgs,
) -> crate::error::Result<PkceTokens> {
    let pkce = Pkce::new()?;

    // CSRF: random state token round-tripped through the redirect.
    let mut state_bytes = [0u8; 16];
    getrandom::getrandom(&mut state_bytes).map_err(|e| Error::Crypto(e.to_string()))?;
    let state = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(state_bytes);

    // Bind localhost listener first so we know which port to register as redirect_uri.
    let (redirect_uri, wait_fut) = listen_for_callback(
        state.clone(),
        Duration::from_secs(args.timeout_seconds),
    )
    .await?;

    // Build authorize URL.
    let mut auth_url = Url::parse(&args.authorize_url)?;
    {
        let mut qp = auth_url.query_pairs_mut();
        qp.append_pair("response_type", "code");
        qp.append_pair("client_id", &args.client_id);
        qp.append_pair("redirect_uri", &redirect_uri);
        qp.append_pair("scope", &args.scopes);
        qp.append_pair("state", &state);
        qp.append_pair("code_challenge", &pkce.challenge);
        qp.append_pair("code_challenge_method", "S256");
        for (k, v) in &args.extra_authorize_params {
            qp.append_pair(k, v);
        }
    }

    tracing::info!(provider = %args.provider, "opening browser for OAuth");
    app.opener2()
        .open_url(auth_url.as_str(), None)
        .map_err(|e| Error::ProviderError(e.to_string()))?;

    // Wait for the redirect to land on our localhost listener.
    let captured = wait_fut.await?;

    // Exchange the authorization code for tokens (PKCE — no client secret).
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;
    let resp: TokenResponse = client
        .post(&args.token_url)
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", &args.client_id),
            ("code", &captured.code),
            ("redirect_uri", &redirect_uri),
            ("code_verifier", &pkce.verifier),
        ])
        .send()
        .await?
        .json()
        .await?;

    if let Some(err) = resp.error {
        return Err(Error::ProviderError(format!(
            "{}: {}",
            err,
            resp.error_description.unwrap_or_default()
        )));
    }

    Ok(PkceTokens {
        access_token: resp.access_token,
        refresh_token: resp.refresh_token,
        expires_in: resp.expires_in,
        token_type: resp.token_type,
        scope: resp.scope,
    })
}
