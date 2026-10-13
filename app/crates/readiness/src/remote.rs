use crate::{Check, Client, GpuHistory, Mode, Settings, Snapshot, State};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use url::Url;

pub const PROTOCOL_VERSION: u32 = 1;
pub const MAX_SAMPLE_AGE_MS: u64 = 65_000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum HostDetails {
    Local,
    Linked,
    NotLinked,
    Unreachable,
    Unauthorized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthEnvelope {
    pub protocol_version: u32,
    pub sample_age_ms: u64,
    pub snapshot: Snapshot,
}

pub(crate) struct RemoteHost {
    pub status: HostDetails,
    pub snapshot: Option<Snapshot>,
    pub detail: &'static str,
}

impl RemoteHost {
    fn unavailable(status: HostDetails, detail: &'static str) -> Self {
        Self {
            status,
            snapshot: None,
            detail,
        }
    }

    pub(crate) fn unknown_check(&self, id: &str, title: &str) -> Check {
        let label = match self.status {
            HostDetails::NotLinked => "Not linked",
            HostDetails::Unauthorized => "Key rejected",
            _ => "Unverified",
        };
        Check::new(id, title, State::Unknown, label, self.detail)
            .help("Run the Shambu host companion on the GPU PC and add its pairing key in Connection settings.")
    }
}

pub fn valid_pairing_key(key: &str) -> bool {
    key.len() == 64
        && key
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

pub fn diagnostics_endpoint(settings: &Settings, base: &Url) -> Result<Url, String> {
    if !settings.diagnostics_key.is_empty() && !valid_pairing_key(&settings.diagnostics_key) {
        return Err("The pairing key should contain 64 lowercase hexadecimal characters. Copy it again from the GPU PC.".into());
    }
    if settings.diagnostics_url.trim().is_empty() {
        let mut url = base.clone();
        url.set_port(Some(11435))
            .map_err(|_| "Could not determine the host companion address.")?;
        return Ok(url);
    }
    let url = Url::parse(settings.diagnostics_url.trim())
        .map_err(|_| "Enter a full http:// or https:// companion URL.".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return Err(
            "Use a companion base URL without credentials, paths, queries, or fragments.".into(),
        );
    }
    if url.host() != base.host() {
        return Err("The companion URL must use the same host as the Ollama URL. Only the port and http/https scheme may differ.".into());
    }
    Ok(url)
}

fn valid_envelope(envelope: &HealthEnvelope, transport_age_ms: u64) -> bool {
    let expected = ["ollama", "tailscale", "forwarding", "gpu", "models"];
    envelope.protocol_version == PROTOCOL_VERSION
        && envelope.sample_age_ms.saturating_add(transport_age_ms) <= MAX_SAMPLE_AGE_MS
        && envelope.snapshot.mode == Mode::Host
        && envelope.snapshot.host_details == HostDetails::Local
        && envelope.snapshot.checks.len() == expected.len()
        && envelope
            .snapshot
            .gpu_history
            .as_ref()
            .is_none_or(GpuHistory::is_valid)
        && expected.iter().all(|id| {
            envelope
                .snapshot
                .checks
                .iter()
                .filter(|check| check.id == *id)
                .count()
                == 1
        })
}

/// Reads history only from the fixed local companion using its private pairing key.
/// Host inspection deliberately does not call this helper, preventing recursive health probes.
pub async fn local_gpu_history(key: &str) -> Option<GpuHistory> {
    if !valid_pairing_key(key) {
        return None;
    }
    let endpoint = Url::parse("http://127.0.0.1:11435/").ok()?;
    fetch(&crate::http_client().ok()?, &endpoint, key)
        .await
        .snapshot?
        .gpu_history
}

pub(crate) async fn inspect(settings: &Settings, base: &Url, client: &Client) -> RemoteHost {
    if settings.diagnostics_key.is_empty() {
        return RemoteHost::unavailable(
            HostDetails::NotLinked,
            "Link the host companion to read this status from the GPU PC. Ollama is checked directly from this device.",
        );
    }
    let Ok(endpoint) = diagnostics_endpoint(settings, base) else {
        return RemoteHost::unavailable(
            HostDetails::Unreachable,
            "The companion address is invalid.",
        );
    };
    fetch(client, &endpoint, &settings.diagnostics_key).await
}

async fn fetch(client: &Client, endpoint: &Url, key: &str) -> RemoteHost {
    let start = Instant::now();
    let request = client
        .get(endpoint.join("health").expect("Validated base URL"))
        .bearer_auth(key);
    let response = match request.send().await {
        Ok(response) => response,
        Err(_) => {
            return RemoteHost::unavailable(
                HostDetails::Unreachable,
                "The host companion did not reply. Check that it is running and its private Tailscale forward is enabled.",
            )
        }
    };
    if matches!(response.status().as_u16(), 401 | 403) {
        return RemoteHost::unavailable(
            HostDetails::Unauthorized,
            "The GPU PC rejected this pairing key. Copy the current key from its Shambu app.",
        );
    }
    let envelope = crate::read_json_response(response)
        .await
        .ok()
        .and_then(|json| serde_json::from_value::<HealthEnvelope>(json).ok());
    match envelope {
        Some(envelope) if valid_envelope(&envelope, start.elapsed().as_millis() as u64) => RemoteHost {
            status: HostDetails::Linked,
            snapshot: Some(envelope.snapshot),
            detail: "Host details were read from the GPU PC.",
        },
        _ => RemoteHost::unavailable(
            HostDetails::Unreachable,
            "The host companion returned an incomplete, outdated, or unsupported status. Update or restart the companion when convenient.",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn fixture() -> serde_json::Value {
        json!({
            "protocolVersion":1, "sampleAgeMs":25,
            "snapshot":{
                "checkedAtMs":1, "endpoint":"http://127.0.0.1:11434",
                "mode":"host", "hostDetails":"local",
                "checks":(["ollama","tailscale","forwarding","gpu","models"].map(|id| json!({
                    "id":id,"title":id,"state":"ok","label":"Active","detail":"Fixture","help":null
                }))),
                "version":"fixture","latencyMs":1,"modelCount":1,"loadedModels":[]
            }
        })
    }

    async fn server_probe(status: u16, body: serde_json::Value) -> RemoteHost {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint = Url::parse(&format!("http://{}", listener.local_addr().unwrap())).unwrap();
        let key = "a".repeat(64);
        let expected_key = key.clone();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = vec![0; 4096];
            let count = socket.read(&mut bytes).await.unwrap();
            let request = String::from_utf8_lossy(&bytes[..count]).to_lowercase();
            assert!(request.starts_with("get /health "));
            assert!(request.contains(&format!("authorization: bearer {expected_key}")));
            let body = body.to_string();
            let response = format!(
                "HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            socket.write_all(response.as_bytes()).await.unwrap();
        });
        let client = Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .no_proxy()
            .build()
            .unwrap();
        let result = fetch(&client, &endpoint, &key).await;
        server.await.unwrap();
        result
    }

    #[tokio::test]
    async fn companion_requires_fresh_complete_authenticated_host_evidence() {
        assert_eq!(
            server_probe(200, fixture()).await.status,
            HostDetails::Linked
        );
        let mut stale = fixture();
        stale["sampleAgeMs"] = json!(65_001);
        assert_eq!(
            server_probe(200, stale).await.status,
            HostDetails::Unreachable
        );
        let mut missing = fixture();
        missing["snapshot"]["checks"].as_array_mut().unwrap().pop();
        assert_eq!(
            server_probe(200, missing).await.status,
            HostDetails::Unreachable
        );
        let mut duplicate = fixture();
        duplicate["snapshot"]["checks"][1]["id"] = json!("ollama");
        assert_eq!(
            server_probe(200, duplicate).await.status,
            HostDetails::Unreachable
        );
        let mut protocol = fixture();
        protocol["protocolVersion"] = json!(2);
        assert_eq!(
            server_probe(200, protocol).await.status,
            HostDetails::Unreachable
        );
        let mut wrong_mode = fixture();
        wrong_mode["snapshot"]["mode"] = json!("remote");
        assert_eq!(
            server_probe(200, wrong_mode).await.status,
            HostDetails::Unreachable
        );
        assert_eq!(
            server_probe(401, json!({})).await.status,
            HostDetails::Unauthorized
        );
        assert_eq!(
            server_probe(503, json!({})).await.status,
            HostDetails::Unreachable
        );
    }

    #[tokio::test]
    async fn optional_gpu_history_is_compatible_bounded_and_validated() {
        let legacy = server_probe(200, fixture()).await;
        assert_eq!(legacy.status, HostDetails::Linked);
        assert!(legacy.snapshot.unwrap().gpu_history.is_none());
        let mut body = fixture();
        body["snapshot"]["gpuHistory"] =
            json!({"sampledAtMs":3_720_000,"bursts":[3_595_000,3_720_000]});
        let result = server_probe(200, body.clone()).await;
        assert_eq!(result.status, HostDetails::Linked);
        assert_eq!(
            result.snapshot.unwrap().gpu_history.unwrap().bursts,
            vec![3_595_000, 3_720_000]
        );
        for invalid in [
            json!({"sampledAtMs":0,"bursts":[]}),
            json!({"sampledAtMs":10,"bursts":[11]}),
            json!({"sampledAtMs":10,"bursts":[9,8]}),
            json!({"sampledAtMs":10,"bursts":[9,9]}),
            json!({"sampledAtMs":crate::GPU_HISTORY_WINDOW_MS+2,"bursts":[1]}),
            json!({"sampledAtMs":10_000,"bursts":(1..=crate::MAX_GPU_BURSTS as u64+1).collect::<Vec<_>>()}),
        ] {
            body["snapshot"]["gpuHistory"] = invalid;
            assert_eq!(
                server_probe(200, body.clone()).await.status,
                HostDetails::Unreachable
            );
        }
        assert!(local_gpu_history("invalid").await.is_none());
    }

    #[tokio::test]
    async fn no_key_never_probes_or_reports_client_tailscale_as_the_host() {
        let settings = Settings {
            mode: Mode::Remote,
            endpoint: "http://192.0.2.1:11434".into(),
            ..Settings::default()
        };
        let base = Url::parse(&settings.endpoint).unwrap();
        let result = inspect(&settings, &base, &Client::new()).await;
        assert_eq!(result.status, HostDetails::NotLinked);
        let row = result.unknown_check("tailscale", "Tailscale on server");
        assert_eq!(row.state, State::Unknown);
        assert_eq!(row.label, "Not linked");
    }

    #[test]
    fn old_settings_still_load_and_diagnostics_urls_are_restricted() {
        let mut settings: Settings = serde_json::from_value(json!({
            "mode":"remote","endpoint":"http://192.0.2.10:11434","name":"Fixture"
        }))
        .unwrap();
        assert!(settings.diagnostics_key.is_empty());
        let base = Url::parse(&settings.endpoint).unwrap();
        assert_eq!(
            diagnostics_endpoint(&settings, &base).unwrap().as_str(),
            "http://192.0.2.10:11435/"
        );
        for invalid in [
            "file:///private",
            "http://user:pass@192.0.2.10",
            "http://192.0.2.10/health",
            "https://192.0.2.10?key=value",
            "http://localhost:11435",
            "http://192.0.2.11:11435",
        ] {
            settings.diagnostics_url = invalid.into();
            assert!(diagnostics_endpoint(&settings, &base).is_err());
        }
        settings.diagnostics_url = "https://192.0.2.10:443".into();
        settings.diagnostics_key = "a".repeat(64);
        assert!(diagnostics_endpoint(&settings, &base).is_ok());
        assert!(!format!("{settings:?}").contains(&settings.diagnostics_key));
        settings.diagnostics_key = "x".repeat(64);
        assert!(diagnostics_endpoint(&settings, &base).is_err());
    }
}
