pub mod config;
mod history;

use axum::{
    extract::{Request, State},
    http::{header, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use readiness::{GpuHistory, HealthEnvelope, Settings, Snapshot, PROTOCOL_VERSION};
use std::{sync::Arc, time::Duration};
use subtle::ConstantTimeEq;
use tokio::{sync::RwLock, time::Instant};

pub const LISTEN_ADDRESS: &str = "127.0.0.1:11435";
const MAX_AGE: Duration = Duration::from_secs(60);

#[derive(Clone, Default)]
pub struct SnapshotCache {
    sample: Arc<RwLock<Option<Sample>>>,
    gpu_history: Arc<RwLock<Option<GpuHistory>>>,
}

struct Sample {
    measured_at: Instant,
    snapshot: Snapshot,
}

impl SnapshotCache {
    async fn update(&self, measured_at: Instant, snapshot: Snapshot) {
        *self.sample.write().await = Some(Sample {
            measured_at,
            snapshot,
        });
    }

    async fn read(&self) -> Option<HealthEnvelope> {
        let guard = self.sample.read().await;
        let sample = guard.as_ref()?;
        let age = sample.measured_at.elapsed();
        if age > MAX_AGE {
            return None;
        }
        let mut snapshot = sample.snapshot.clone();
        snapshot.gpu_history = self.gpu_history.read().await.clone();
        Some(HealthEnvelope {
            protocol_version: PROTOCOL_VERSION,
            sample_age_ms: age.as_millis() as u64,
            snapshot,
        })
    }
}

#[derive(Clone)]
struct AgentState {
    key: [u8; 64],
    cache: SnapshotCache,
}

fn authorized(headers: &HeaderMap, key: &[u8; 64]) -> bool {
    if headers.get_all(header::AUTHORIZATION).iter().count() != 1 {
        return false;
    }
    let Some(value) = headers.get(header::AUTHORIZATION) else {
        return false;
    };
    let Some(candidate) = value.as_bytes().strip_prefix(b"Bearer ") else {
        return false;
    };
    // The credential length is public and fixed. Equal-length comparisons use subtle.
    candidate.len() == key.len() && bool::from(candidate.ct_eq(key))
}

async fn authenticate(State(state): State<AgentState>, request: Request, next: Next) -> Response {
    let mut response = if !authorized(request.headers(), &state.key) {
        (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
            "Pairing key required.",
        )
            .into_response()
    } else if request.uri().query().is_some()
        || request.headers().contains_key(header::TRANSFER_ENCODING)
        || request
            .headers()
            .get(header::CONTENT_LENGTH)
            .is_some_and(|value| value != "0")
    {
        (
            StatusCode::BAD_REQUEST,
            "This endpoint accepts no query or request body.",
        )
            .into_response()
    } else {
        next.run(request).await
    };
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    response
        .headers_mut()
        .insert(header::CONNECTION, "close".parse().unwrap());
    response
        .headers_mut()
        .insert("x-content-type-options", "nosniff".parse().unwrap());
    response
}

async fn health(State(state): State<AgentState>) -> Response {
    match state.cache.read().await {
        Some(envelope) => Json(envelope).into_response(),
        None => (
            StatusCode::SERVICE_UNAVAILABLE,
            "A fresh host check is not available yet.",
        )
            .into_response(),
    }
}

pub fn router(cache: SnapshotCache, key: &str) -> Result<Router, String> {
    if !readiness::valid_pairing_key(key) {
        return Err(
            "The stored pairing key is invalid. Initialize a new private configuration.".into(),
        );
    }
    let mut fixed_key = [0; 64];
    fixed_key.copy_from_slice(key.as_bytes());
    let state = AgentState {
        cache,
        key: fixed_key,
    };
    Ok(Router::new()
        .route(
            "/health",
            get(health).head(|| async { StatusCode::METHOD_NOT_ALLOWED }),
        )
        .fallback(|| async { (StatusCode::NOT_FOUND, "Not found.") })
        .layer(middleware::from_fn_with_state(state.clone(), authenticate))
        .with_state(state))
}

pub fn spawn_sampler(cache: SnapshotCache, settings: Settings) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        // Both loops belong to this task, so aborting the sampler also stops utilization probes.
        tokio::join!(
            sample_readiness(cache.clone(), settings),
            history::collect(cache)
        );
    })
}

async fn sample_readiness(cache: SnapshotCache, settings: Settings) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        let measured_at = Instant::now();
        // CLI probes and HTTP calls already have short individual timeouts.
        // This outer bound prevents an unexpected stalled cycle retaining old health forever.
        if let Ok(Ok(snapshot)) = tokio::time::timeout(
            Duration::from_secs(15),
            readiness::inspect(settings.clone()),
        )
        .await
        {
            cache.update(measured_at, snapshot).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use readiness::{Check, HostDetails, Mode, State as CheckState};
    use tower::ServiceExt;

    fn fixture() -> Snapshot {
        Snapshot {
            checked_at_ms: 1,
            host_details: HostDetails::Local,
            endpoint: "http://127.0.0.1:11434".into(),
            mode: Mode::Host,
            checks: ["ollama", "tailscale", "forwarding", "gpu", "models"]
                .map(|id| Check {
                    id: id.into(),
                    title: id.into(),
                    state: CheckState::Ok,
                    label: "Active".into(),
                    detail: "Fixture".into(),
                    help: None,
                })
                .to_vec(),
            version: Some("fixture".into()),
            latency_ms: Some(1),
            model_count: Some(1),
            loaded_models: vec![],
            gpu_history: None,
        }
    }

    async fn request(router: Router, method: &str, path: &str, key: Option<&str>) -> Response {
        let mut request = Request::builder().method(method).uri(path);
        if let Some(key) = key {
            request = request.header(header::AUTHORIZATION, format!("Bearer {key}"));
        }
        router
            .oneshot(request.body(Body::empty()).unwrap())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn authentication_and_read_only_route_are_enforced() {
        let key = "a".repeat(64);
        let cache = SnapshotCache::default();
        cache.update(Instant::now(), fixture()).await;
        let app = router(cache, &key).unwrap();
        assert_eq!(
            request(app.clone(), "GET", "/health", None).await.status(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            request(app.clone(), "GET", "/health", Some(&"b".repeat(64)))
                .await
                .status(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            request(app.clone(), "POST", "/health", Some(&key))
                .await
                .status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
        assert_eq!(
            request(app.clone(), "HEAD", "/health", Some(&key))
                .await
                .status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
        assert_eq!(
            request(app.clone(), "GET", "/api/generate", Some(&key))
                .await
                .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            request(app.clone(), "GET", "/health?command=stop", Some(&key))
                .await
                .status(),
            StatusCode::BAD_REQUEST
        );
        let response = request(app, "GET", "/health", Some(&key)).await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        assert!(!response
            .headers()
            .contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN));
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body = String::from_utf8(bytes.to_vec()).unwrap();
        assert!(!body.contains(&key));
        let envelope: HealthEnvelope = serde_json::from_str(&body).unwrap();
        assert_eq!(envelope.protocol_version, 1);
        assert_eq!(envelope.snapshot.checks.len(), 5);
    }

    #[tokio::test(start_paused = true)]
    async fn requests_use_cache_and_expired_samples_are_not_served() {
        let key = "c".repeat(64);
        let cache = SnapshotCache::default();
        let app = router(cache.clone(), &key).unwrap();
        assert_eq!(
            request(app.clone(), "GET", "/health", Some(&key))
                .await
                .status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
        cache.update(Instant::now(), fixture()).await;
        let first = request(app.clone(), "GET", "/health", Some(&key)).await;
        let first: HealthEnvelope =
            serde_json::from_slice(&first.into_body().collect().await.unwrap().to_bytes()).unwrap();
        tokio::time::advance(Duration::from_secs(10)).await;
        let second = request(app.clone(), "GET", "/health", Some(&key)).await;
        let second: HealthEnvelope =
            serde_json::from_slice(&second.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(first.snapshot.checked_at_ms, second.snapshot.checked_at_ms);
        assert!(second.sample_age_ms >= 10_000);
        tokio::time::advance(Duration::from_secs(51)).await;
        assert_eq!(
            request(app, "GET", "/health", Some(&key)).await.status(),
            StatusCode::SERVICE_UNAVAILABLE
        );
    }

    #[tokio::test]
    async fn cached_health_includes_independently_updated_gpu_history() {
        let key = "d".repeat(64);
        let cache = SnapshotCache::default();
        cache.update(Instant::now(), fixture()).await;
        *cache.gpu_history.write().await = Some(GpuHistory {
            sampled_at_ms: 3_601_000,
            bursts: vec![3_599_000],
        });
        let app = router(cache.clone(), &key).unwrap();
        assert_eq!(
            request(app.clone(), "GET", "/health", None).await.status(),
            StatusCode::UNAUTHORIZED
        );
        let response = request(app, "GET", "/health", Some(&key)).await;
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let envelope: HealthEnvelope = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(envelope.snapshot.checked_at_ms, 1);
        assert_eq!(
            envelope.snapshot.gpu_history.unwrap().bursts,
            vec![3_599_000]
        );
        *cache.gpu_history.write().await = Some(GpuHistory {
            sampled_at_ms: 3_666_000,
            bursts: vec![3_599_000, 3_666_000],
        });
        assert_eq!(
            cache
                .read()
                .await
                .unwrap()
                .snapshot
                .gpu_history
                .unwrap()
                .bursts
                .len(),
            2
        );
    }

    #[test]
    fn duplicate_auth_and_short_keys_are_rejected() {
        let key = [b'a'; 64];
        let mut headers = HeaderMap::new();
        headers.append(
            header::AUTHORIZATION,
            format!("Bearer {}", "a".repeat(64)).parse().unwrap(),
        );
        headers.append(header::AUTHORIZATION, "Bearer ignored".parse().unwrap());
        assert!(!authorized(&headers, &key));
        assert!(router(SnapshotCache::default(), "short").is_err());
    }
}
