use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::{
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use subtle::ConstantTimeEq;
use tokio::{sync::Mutex, time::Instant};

const LIFETIME: Duration = Duration::from_secs(300);
const MAX_ATTEMPTS: u8 = 5;
const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#[derive(Clone, Default)]
pub(super) struct Pairing(Arc<Mutex<Option<Pending>>>);
struct Pending {
    code: [u8; 8],
    expires: Instant,
    attempts: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCode {
    code: String,
    expires_at_ms: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CodeRequest {
    code: String,
}

// Creating a code is protected by the existing full-length host credential.
pub(super) async fn create(State(state): State<super::AgentState>) -> Response {
    let mut entropy = [0u8; 8];
    if getrandom::fill(&mut entropy).is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not create a pairing code.",
        )
            .into_response();
    }
    let code = entropy.map(|byte| ALPHABET[usize::from(byte & 31)]);
    *state.pairing.0.lock().await = Some(Pending {
        code,
        expires: Instant::now() + LIFETIME,
        attempts: 0,
    });
    let expires_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
        + LIFETIME.as_millis() as u64;
    Json(PairingCode {
        code: String::from_utf8_lossy(&code).into_owned(),
        expires_at_ms,
    })
    .into_response()
}

pub(super) async fn exchange(
    State(state): State<super::AgentState>,
    Json(input): Json<CodeRequest>,
) -> Response {
    // One global budget per code also bounds attempts arriving through a TCP forward.
    let mut guard = state.pairing.0.lock().await;
    let Some(pending) = guard.as_mut() else {
        return (StatusCode::UNAUTHORIZED, "Create a new code on the GPU PC.").into_response();
    };
    if pending.expires <= Instant::now() {
        *guard = None;
        return (
            StatusCode::UNAUTHORIZED,
            "This code expired. Create a new one on the GPU PC.",
        )
            .into_response();
    }
    if pending.attempts >= MAX_ATTEMPTS {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            "Too many attempts. Create a new code on the GPU PC.",
        )
            .into_response();
    }
    pending.attempts += 1;
    let matches = input.code.len() == 8 && bool::from(input.code.as_bytes().ct_eq(&pending.code));
    if !matches {
        return (
            StatusCode::UNAUTHORIZED,
            "Code not accepted. Check the code on the GPU PC.",
        )
            .into_response();
    }
    // Consume under the same lock, so two simultaneous requests cannot redeem a code.
    *guard = None;
    Json(serde_json::json!({ "key": String::from_utf8_lossy(&state.key) })).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{header, Request},
        Router,
    };
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn call(app: &Router, path: &str, key: bool, body: &str) -> Response {
        let mut request = Request::builder().method("POST").uri(path);
        if key {
            request = request.header(header::AUTHORIZATION, format!("Bearer {}", "a".repeat(64)));
        }
        if !body.is_empty() {
            request = request.header(header::CONTENT_TYPE, "application/json");
        }
        app.clone()
            .oneshot(request.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap()
    }
    async fn code(app: &Router) -> String {
        let response = call(app, "/pairing/new", true, "").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        let value: serde_json::Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        let code = value["code"].as_str().unwrap().to_string();
        assert_eq!(code.len(), 8);
        assert!(code.bytes().all(|byte| ALPHABET.contains(&byte)));
        code
    }
    #[tokio::test(start_paused = true)]
    async fn code_is_authorized_single_use_expiring_and_rate_limited() {
        let app =
            super::super::router(super::super::SnapshotCache::default(), &"a".repeat(64)).unwrap();
        assert_eq!(
            call(&app, "/pairing/new", false, "").await.status(),
            StatusCode::UNAUTHORIZED
        );
        let first = code(&app).await;
        let second = code(&app).await;
        assert_eq!(
            call(
                &app,
                "/pairing",
                false,
                &format!("{{\"code\":\"{first}\"}}")
            )
            .await
            .status(),
            StatusCode::UNAUTHORIZED
        );
        let body = format!("{{\"code\":\"{second}\"}}");
        let response = call(&app, "/pairing", false, &body).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        let value: serde_json::Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(value["key"], "a".repeat(64));
        assert_eq!(
            call(&app, "/pairing", false, &body).await.status(),
            StatusCode::UNAUTHORIZED
        );
        let fresh = code(&app).await;
        tokio::time::advance(LIFETIME).await;
        assert_eq!(
            call(
                &app,
                "/pairing",
                false,
                &format!("{{\"code\":\"{fresh}\"}}")
            )
            .await
            .status(),
            StatusCode::UNAUTHORIZED
        );
        let fresh = code(&app).await;
        for _ in 0..MAX_ATTEMPTS {
            assert_eq!(
                call(&app, "/pairing", false, "{\"code\":\"00000000\"}")
                    .await
                    .status(),
                StatusCode::UNAUTHORIZED
            );
        }
        assert_eq!(
            call(
                &app,
                "/pairing",
                false,
                &format!("{{\"code\":\"{fresh}\"}}")
            )
            .await
            .status(),
            StatusCode::TOO_MANY_REQUESTS
        );
        let request = Request::builder()
            .method("POST")
            .uri("/pairing")
            .header(header::ORIGIN, "https://example.com")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from("{\"code\":\"00000000\"}"))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(!response
            .headers()
            .contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
