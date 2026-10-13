mod local;
mod pairing;
mod remote;
pub use pairing::{create_pairing_code, pair_host, valid_code, PairingCode};

pub use local::gpu_active;
pub use remote::{
    diagnostics_endpoint, local_gpu_history, valid_pairing_key, HealthEnvelope, HostDetails,
    PROTOCOL_VERSION,
};

use reqwest::{redirect::Policy, Client};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use url::Url;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Host,
    Remote,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub mode: Mode,
    pub endpoint: String,
    pub name: String,
    #[serde(default)]
    pub diagnostics_key: String,
    #[serde(default)]
    pub diagnostics_url: String,
}

impl std::fmt::Debug for Settings {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Settings")
            .field("mode", &self.mode)
            .field("endpoint", &self.endpoint)
            .field("name", &self.name)
            .field("diagnostics_url", &self.diagnostics_url)
            .field("diagnostics_key", &"[redacted]")
            .finish()
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            mode: if cfg!(target_os = "android") {
                Mode::Remote
            } else {
                Mode::Host
            },
            endpoint: if cfg!(target_os = "android") {
                String::new()
            } else {
                "http://127.0.0.1:11434".into()
            },
            name: "My GPU server".into(),
            diagnostics_key: String::new(),
            diagnostics_url: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Ok,
    Warning,
    Error,
    Unknown,
    Idle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub id: String,
    pub title: String,
    pub state: State,
    pub label: String,
    pub detail: String,
    pub help: Option<String>,
}

impl Check {
    pub(crate) fn new(
        id: &str,
        title: &str,
        state: State,
        label: &str,
        detail: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            state,
            label: label.into(),
            detail: detail.into(),
            help: None,
        }
    }
    pub(crate) fn help(mut self, help: &str) -> Self {
        self.help = Some(help.into());
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedModel {
    pub name: String,
    pub size: u64,
    pub size_vram: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModel {
    pub name: String,
    pub size: u64,
}

pub const GPU_HISTORY_SOURCE: &str = "ollama-gpu-estimate";
pub const GPU_HISTORY_HOUR_MS: u64 = 60 * 60 * 1_000;
pub const GPU_HISTORY_WINDOW_MS: u64 = 48 * GPU_HISTORY_HOUR_MS;
pub const MAX_GPU_BURSTS: usize = 3_000;
pub const MAX_GPU_ACTIVE_HOURS: usize = 49;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GpuHistory {
    #[serde(default)]
    pub source: String,
    pub sampled_at_ms: u64,
    pub bursts: Vec<u64>,
    #[serde(default)]
    pub active_hours: Vec<u64>,
}

impl GpuHistory {
    pub(crate) fn is_valid(&self) -> bool {
        let cutoff = self.sampled_at_ms.saturating_sub(GPU_HISTORY_WINDOW_MS);
        let first_hour = cutoff / GPU_HISTORY_HOUR_MS * GPU_HISTORY_HOUR_MS;
        let last_hour = self.sampled_at_ms / GPU_HISTORY_HOUR_MS * GPU_HISTORY_HOUR_MS;
        self.source == GPU_HISTORY_SOURCE
            && self.sampled_at_ms > 0
            && self.bursts.len() <= MAX_GPU_BURSTS
            && self
                .bursts
                .iter()
                .all(|time| *time >= cutoff && *time <= self.sampled_at_ms)
            && self.bursts.windows(2).all(|pair| pair[0] < pair[1])
            && self.active_hours.len() <= MAX_GPU_ACTIVE_HOURS
            && self.active_hours.iter().all(|hour| {
                *hour >= first_hour && *hour <= last_hour && *hour % GPU_HISTORY_HOUR_MS == 0
            })
            && self.active_hours.windows(2).all(|pair| pair[0] < pair[1])
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub checked_at_ms: u64,
    pub host_details: HostDetails,
    pub endpoint: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub external_endpoint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpu_name: Option<String>,
    pub mode: Mode,
    pub checks: Vec<Check>,
    pub version: Option<String>,
    pub latency_ms: Option<u64>,
    pub model_count: Option<usize>,
    pub loaded_models: Vec<LoadedModel>,
    #[serde(default)]
    pub installed_models: Vec<InstalledModel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpu_history: Option<GpuHistory>,
}

pub fn validate_settings(settings: &Settings) -> Result<Url, String> {
    if settings.name.trim().is_empty() || settings.name.chars().count() > 60 {
        return Err("Give your server a name between 1 and 60 characters.".into());
    }
    let mut url = Url::parse(settings.endpoint.trim())
        .map_err(|_| "Enter a full server URL, such as http://127.0.0.1:11434.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Use an http:// or https:// server URL.".into());
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Use a base URL without credentials, a query, or a fragment.".into());
    }
    if url.path() != "/" && !url.path().is_empty() {
        return Err("Use the base URL only. Remove /api/version, /v1, or any other path.".into());
    }
    if settings.mode == Mode::Host && !is_loopback(&url) {
        return Err(
            "This computer needs a loopback URL. Choose Remote server for another device.".into(),
        );
    }
    if settings.mode == Mode::Remote && is_loopback(&url) {
        return Err(
            "A remote server needs its own address. Localhost refers to this device.".into(),
        );
    }
    url.set_path("/");
    diagnostics_endpoint(settings, &url)?;
    Ok(url)
}

fn is_loopback(url: &Url) -> bool {
    url.host_str().is_some_and(|host| {
        host.eq_ignore_ascii_case("localhost")
            || host
                .trim_matches(['[', ']'])
                .parse::<std::net::IpAddr>()
                .is_ok_and(|ip| ip.is_loopback())
    })
}

pub(crate) async fn get_json(client: &Client, base: &Url, path: &str) -> Result<Value, String> {
    let url = base
        .join(path)
        .map_err(|_| "The endpoint is invalid.".to_string())?;
    let response = client.get(url).send().await.map_err(|error| -> String {
        if error.is_timeout() {
            "The server did not reply within 4 seconds.".into()
        } else if error.is_connect() {
            "Could not connect to this address.".into()
        } else {
            "The connection failed. Check the address and network.".into()
        }
    })?;
    read_json_response(response).await
}

async fn read_json_response(mut response: reqwest::Response) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(format!(
            "The server returned HTTP {}.",
            response.status().as_u16()
        ));
    }
    const MAX_BYTES: usize = 2 * 1024 * 1024;
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The response was interrupted.".to_string())?
    {
        if bytes.len() + chunk.len() > MAX_BYTES {
            return Err("The response was larger than expected.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| "The address did not return valid Ollama JSON.".into())
}

fn parse_version(result: &Result<Value, String>) -> Result<String, String> {
    result
        .as_ref()
        .map_err(Clone::clone)?
        .get("version")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty() && s.len() < 100)
        .map(str::to_owned)
        .ok_or_else(|| "The response did not include an Ollama version.".into())
}

fn parse_models(result: Result<Value, String>) -> Result<Vec<LoadedModel>, String> {
    let value = result?;
    let items = value
        .get("models")
        .and_then(Value::as_array)
        .ok_or_else(|| "Ollama did not return a running-model list.".to_string())?;
    items
        .iter()
        .map(|item| {
            let name = item
                .get("name")
                .and_then(Value::as_str)
                .ok_or_else(|| "Ollama returned an incomplete model entry.".to_string())?;
            let size = item.get("size").and_then(Value::as_u64).unwrap_or(0);
            Ok(LoadedModel {
                name: name.into(),
                size,
                size_vram: item.get("size_vram").and_then(Value::as_u64),
            })
        })
        .collect()
}

fn parse_installed_models(result: Result<Value, String>) -> Result<Vec<InstalledModel>, String> {
    let value = result?;
    let items = value
        .get("models")
        .and_then(Value::as_array)
        .ok_or_else(|| "Ollama did not return an installed-model list.".to_string())?;
    items
        .iter()
        .map(|item| {
            let name = item
                .get("name")
                .and_then(Value::as_str)
                .filter(|name| !name.is_empty())
                .ok_or_else(|| {
                    "Ollama returned an incomplete installed-model entry.".to_string()
                })?;
            Ok(InstalledModel {
                name: name.into(),
                size: item.get("size").and_then(Value::as_u64).unwrap_or(0),
            })
        })
        .collect()
}

fn gpu_from_models(models: &[LoadedModel]) -> Check {
    if models.is_empty() {
        return Check::new(
            "gpu",
            "GPU inference",
            State::Idle,
            "Idle",
            "No model is loaded. GPU use cannot be confirmed until a model is running.",
        );
    }
    if models
        .iter()
        .any(|model| model.size_vram.is_none() || model.size == 0)
    {
        return Check::new(
            "gpu",
            "GPU inference",
            State::Unknown,
            "Unverified",
            "Ollama did not report enough memory information to determine GPU loading.",
        );
    }
    if models.iter().any(|model| model.size_vram == Some(0)) {
        return Check::new("gpu", "GPU inference", State::Warning, "CPU detected",
            "At least one loaded model has no GPU memory allocation.")
            .help("On the server, check ollama ps and the GPU driver. Restart Ollama only after active work finishes.");
    }
    if models
        .iter()
        .any(|model| model.size_vram.unwrap_or(0) < model.size)
    {
        return Check::new("gpu", "GPU inference", State::Warning, "GPU + CPU",
            "At least one loaded model is split between GPU memory and system memory.")
            .help("A smaller model or context may fit in VRAM. Check ollama ps on the server before changing anything.");
    }
    Check::new("gpu", "GPU inference", State::Ok, "On GPU",
        "Ollama reports the loaded models fully allocated to GPU memory. This does not measure current GPU utilization.")
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(4))
        .connect_timeout(Duration::from_secs(3))
        .redirect(Policy::none())
        .no_proxy()
        .user_agent("shambu/0.1")
        .build()
        .map_err(|_| "Could not initialize networking.".to_string())
}

pub async fn inspect(settings: Settings) -> Result<Snapshot, String> {
    let base = validate_settings(&settings)?;
    let client = http_client()?;
    let start = Instant::now();
    let version_probe = async {
        let response = get_json(&client, &base, "api/version").await;
        (parse_version(&response), start.elapsed().as_millis() as u64)
    };
    let host_probe = async {
        if settings.mode == Mode::Host {
            Some(local::inspect_local(Mode::Host).await)
        } else {
            None
        }
    };
    let remote_probe = async {
        if settings.mode == Mode::Remote {
            Some(remote::inspect(&settings, &base, &client).await)
        } else {
            None
        }
    };
    let ((version, elapsed), tags, running, desktop, remote) = tokio::join!(
        version_probe,
        get_json(&client, &base, "api/tags"),
        get_json(&client, &base, "api/ps"),
        host_probe,
        remote_probe
    );

    let api_ok = version.is_ok();
    let ollama = match &version {
        Ok(version) => Check::new("ollama", if settings.mode == Mode::Host { "Ollama local URL" } else { "Ollama server" },
            State::Ok, "Active", format!("Ollama {version} replied in {elapsed} ms.")),
        Err(error) => Check::new("ollama", if settings.mode == Mode::Host { "Ollama local URL" } else { "Ollama server" },
            State::Error, "Unreachable", error.clone())
            .help(if settings.mode == Mode::Host {
                "Check that Ollama is running and the local port is correct. This app does not restart your server."
            } else {
                "Check the server address, then open Tailscale on both devices. The server PC must be awake."
            }),
    };
    let installed_models = parse_installed_models(tags);
    let model_count = installed_models.as_ref().ok().map(Vec::len);
    let library = match model_count {
        Some(0) => Check::new(
            "models",
            "Model library",
            State::Warning,
            "Empty",
            "Ollama is responding, but no installed models were returned.",
        )
        .help("Download a model on the server with Ollama when you are ready to use it."),
        Some(count) => Check::new(
            "models",
            "Model library",
            State::Ok,
            &format!("{count} available"),
            "Models are installed on the server. This check does not load them.",
        ),
        None => Check::new(
            "models",
            "Model library",
            State::Unknown,
            "Unverified",
            installed_models
                .as_ref()
                .err()
                .cloned()
                .unwrap_or_else(|| "The response did not include a model list.".into()),
        ),
    };
    let models = parse_models(running);
    let mut gpu = match &models {
        Ok(models) => gpu_from_models(models),
        Err(error) => Check::new(
            "gpu",
            "GPU inference",
            State::Unknown,
            "Unverified",
            error.clone(),
        ),
    };
    let gpu_history = remote
        .as_ref()
        .and_then(|host| host.snapshot.as_ref())
        .and_then(|snapshot| snapshot.gpu_history.clone());
    let gpu_name = desktop
        .as_ref()
        .and_then(|local| local.gpu.clone())
        .or_else(|| {
            remote
                .as_ref()
                .and_then(|host| host.snapshot.as_ref())
                .and_then(|snapshot| snapshot.gpu_name.clone())
        });
    let external_endpoint = if let Some(desktop) = &desktop {
        local::external_endpoint(desktop, &base)
    } else {
        Some(base.as_str().trim_end_matches('/').to_owned())
    };
    let (tailscale, forwarding, host_details) = if let Some(desktop) = &desktop {
        if let Some(device) = &desktop.gpu {
            if models.as_ref().is_ok_and(|items| items.is_empty()) {
                gpu.detail = format!("{device} is visible to the driver. No model is loaded, so Ollama GPU use is not yet verified.");
            }
        }
        (
            desktop.tailscale.clone(),
            local::check_forwarding(desktop, &base, &client).await,
            HostDetails::Local,
        )
    } else {
        let remote = remote.expect("Remote mode always runs the companion probe");
        if let Some(host) = &remote.snapshot {
            // Keep API, model, and loaded-GPU evidence measured directly from this client.
            // The companion supplies facts and activity history that require access to the host OS.
            if gpu.state == State::Idle {
                if let Some(host_gpu) = host.checks.iter().find(|check| check.id == "gpu") {
                    if host_gpu.state == State::Idle {
                        gpu.detail = host_gpu.detail.clone();
                    }
                }
            }
            let mut tailscale = host
                .checks
                .iter()
                .find(|check| check.id == "tailscale")
                .expect("Companion schema was checked")
                .clone();
            tailscale.title = "Tailscale on server".into();
            if tailscale.state == State::Ok {
                tailscale.label = "Active".into();
            }
            let mut forwarding = host
                .checks
                .iter()
                .find(|check| check.id == "forwarding")
                .expect("Companion schema was checked")
                .clone();
            forwarding.title = "Server forwarding".into();
            (tailscale, forwarding, remote.status)
        } else {
            (
                remote.unknown_check("tailscale", "Tailscale on server"),
                remote.unknown_check("forwarding", "Server forwarding"),
                remote.status,
            )
        }
    };
    Ok(Snapshot {
        checked_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        host_details,
        endpoint: base.as_str().trim_end_matches('/').into(),
        external_endpoint,
        gpu_name,
        mode: settings.mode,
        checks: vec![ollama, tailscale, forwarding, gpu, library],
        version: version.ok(),
        latency_ms: if api_ok { Some(elapsed) } else { None },
        model_count,
        loaded_models: models.unwrap_or_default(),
        installed_models: installed_models.unwrap_or_default(),
        gpu_history,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(endpoint: &str, mode: Mode) -> Settings {
        Settings {
            endpoint: endpoint.into(),
            mode,
            name: "Test server".into(),
            ..Settings::default()
        }
    }

    #[test]
    fn endpoints_must_be_unambiguous_and_have_no_credentials() {
        for endpoint in [
            "file:///etc/hosts",
            "http://user:password@localhost:11434",
            "http://localhost:11434/v1",
            "http://localhost:11434?secret=value",
            "http://localhost:11434/#x",
        ] {
            assert!(
                validate_settings(&settings(endpoint, Mode::Host)).is_err(),
                "{endpoint}"
            );
        }
        assert!(validate_settings(&settings("http://127.0.0.1:11434", Mode::Remote)).is_err());
        assert!(validate_settings(&settings("http://localhost:11434", Mode::Remote)).is_err());
        assert!(validate_settings(&settings("http://[::1]:11434", Mode::Remote)).is_err());
        assert!(validate_settings(&settings("http://192.0.2.10:11434", Mode::Host)).is_err());
        assert!(validate_settings(&settings("http://192.0.2.10:11434/", Mode::Remote)).is_ok());
    }

    #[test]
    fn installed_models_come_from_the_direct_tags_response() {
        let models = parse_installed_models(Ok(serde_json::json!({"models":[
            {"name":"fixture-small:latest","size":123},
            {"name":"fixture-large:latest","size":456}
        ]})))
        .unwrap();
        assert_eq!(
            models,
            vec![
                InstalledModel {
                    name: "fixture-small:latest".into(),
                    size: 123
                },
                InstalledModel {
                    name: "fixture-large:latest".into(),
                    size: 456
                },
            ]
        );
        assert!(parse_installed_models(Ok(serde_json::json!({"models":[]})))
            .unwrap()
            .is_empty());
        assert!(parse_installed_models(Ok(serde_json::json!({"models":[{"size":10}]}))).is_err());
        assert!(parse_installed_models(Err("Unavailable".into())).is_err());
    }

    #[test]
    fn gpu_evidence_does_not_confuse_idle_missing_partial_and_full() {
        let model = |vram| LoadedModel {
            name: "fixture".into(),
            size: 100,
            size_vram: vram,
        };
        assert_eq!(gpu_from_models(&[]).state, State::Idle);
        assert_eq!(gpu_from_models(&[model(None)]).state, State::Unknown);
        assert_eq!(gpu_from_models(&[model(Some(0))]).label, "CPU detected");
        assert_eq!(gpu_from_models(&[model(Some(60))]).label, "GPU + CPU");
        assert_eq!(gpu_from_models(&[model(Some(100))]).state, State::Ok);
        assert_eq!(
            gpu_from_models(&[model(Some(100)), model(Some(0))]).label,
            "CPU detected"
        );
    }

    #[tokio::test]
    async fn http_probe_refuses_redirects_and_non_ollama_responses() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        for (response, expected) in [
            ("HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:1/private\r\nContent-Length: 0\r\n\r\n", "302"),
            ("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}", "version"),
            ("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nnope", "JSON"),
        ] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let base = Url::parse(&format!("http://{}", listener.local_addr().unwrap())).unwrap();
            let server = tokio::spawn(async move {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut request = [0; 2048];
                let amount = socket.read(&mut request).await.unwrap();
                assert!(String::from_utf8_lossy(&request[..amount]).starts_with("GET /api/version "));
                socket.write_all(response.as_bytes()).await.unwrap();
            });
            let client = Client::builder().redirect(Policy::none()).no_proxy().build().unwrap();
            let result = get_json(&client, &base, "api/version").await;
            let error = parse_version(&result).unwrap_err();
            assert!(error.contains(expected), "{error}");
            server.await.unwrap();
        }
    }
}
