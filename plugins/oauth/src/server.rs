use std::sync::Arc;

use axum::{extract::Query, response::Html, routing::get, Router};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

use crate::error::{Error, Result};

#[derive(Debug, Deserialize)]
struct Callback {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

pub struct Captured {
    pub code: String,
    pub state: String,
}

/// Bind a localhost listener on an OS-assigned port and return the URL
/// (`http://127.0.0.1:PORT/callback`) plus a future that resolves when the
/// browser redirects back with `?code=...`.
pub async fn listen_for_callback(
    expected_state: String,
    wait: Duration,
) -> Result<(String, impl std::future::Future<Output = Result<Captured>>)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let redirect_uri = format!("http://127.0.0.1:{}/callback", addr.port());

    let (tx, rx) = oneshot::channel::<std::result::Result<Captured, String>>();
    let tx = Arc::new(tokio::sync::Mutex::new(Some(tx)));

    let app = Router::new().route(
        "/callback",
        get({
            let tx = tx.clone();
            move |Query(cb): Query<Callback>| async move {
                let send_html: &str;
                let result = if let Some(err) = cb.error {
                    send_html = "<h2>Sign-in failed.</h2><p>You can close this window.</p>";
                    Err(format!(
                        "{}: {}",
                        err,
                        cb.error_description.unwrap_or_default()
                    ))
                } else if let (Some(code), Some(state)) = (cb.code, cb.state) {
                    send_html =
                        "<h2>Signed in.</h2><p>You can close this window and return to Meetspace.</p>";
                    Ok(Captured { code, state })
                } else {
                    send_html = "<h2>Missing code.</h2><p>You can close this window.</p>";
                    Err("missing code or state in callback".to_string())
                };

                if let Some(sender) = tx.lock().await.take() {
                    let _ = sender.send(result);
                }
                Html(send_html.to_string())
            }
        }),
    );

    let fut = async move {
        // Run the server in a task; shut it down once we get one callback.
        let server = tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });

        let captured = match timeout(wait, rx).await {
            Ok(Ok(Ok(c))) => c,
            Ok(Ok(Err(msg))) => {
                server.abort();
                return Err(Error::ProviderError(msg));
            }
            Ok(Err(_)) | Err(_) => {
                server.abort();
                return Err(Error::Cancelled);
            }
        };
        server.abort();

        if captured.state != expected_state {
            return Err(Error::InvalidResponse(
                "state mismatch (possible CSRF)".into(),
            ));
        }
        Ok(captured)
    };

    Ok((redirect_uri, fut))
}
