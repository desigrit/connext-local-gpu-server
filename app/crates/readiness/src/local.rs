#[cfg(any(test, not(target_os = "android")))]
use crate::GpuReading;
use crate::{get_json, Check, GpuMetrics, Mode, State};
use reqwest::Client;
use serde_json::Value;
use std::{path::PathBuf, time::Duration};
use tokio::process::Command;
use url::Url;

pub(crate) struct Local {
    pub tailscale: Check,
    pub addresses: Vec<String>,
    pub serve: Option<Value>,
    pub gpu: Option<String>,
}

#[cfg(not(target_os = "android"))]
fn tailscale_path() -> Option<PathBuf> {
    let mut paths = Vec::new();
    #[cfg(target_os = "windows")]
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        paths.push(
            PathBuf::from(program_files)
                .join("Tailscale")
                .join("tailscale.exe"),
        );
    }
    #[cfg(target_os = "macos")]
    for path in [
        "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
        "/opt/homebrew/bin/tailscale",
        "/usr/local/bin/tailscale",
    ] {
        paths.push(PathBuf::from(path));
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    for path in ["/usr/bin/tailscale", "/usr/local/bin/tailscale"] {
        paths.push(PathBuf::from(path));
    }
    paths.into_iter().find(|path| path.is_file())
}

#[cfg(not(target_os = "android"))]
async fn run(path: &std::path::Path, args: &[&str]) -> Option<String> {
    let mut command = Command::new(path);
    command.args(args).kill_on_drop(true);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(0x08000000);
    }
    let output = tokio::time::timeout(Duration::from_secs(6), command.output())
        .await
        .ok()?
        .ok()?;
    if !output.status.success() || output.stdout.len() > 2 * 1024 * 1024 {
        return None;
    }
    String::from_utf8(output.stdout).ok()
}

#[cfg(not(target_os = "android"))]
fn nvidia_smi_path() -> Option<PathBuf> {
    let mut paths = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Some(windows) = std::env::var_os("SystemRoot") {
            paths.push(
                PathBuf::from(windows)
                    .join("System32")
                    .join("nvidia-smi.exe"),
            );
        }
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            paths.push(
                PathBuf::from(program_files)
                    .join("NVIDIA Corporation")
                    .join("NVSMI")
                    .join("nvidia-smi.exe"),
            );
        }
    }
    #[cfg(not(target_os = "windows"))]
    paths.push(PathBuf::from("/usr/bin/nvidia-smi"));
    paths.into_iter().find(|path| path.is_file())
}

#[cfg(not(target_os = "android"))]
async fn gpu_name(mode: Mode) -> Option<String> {
    if mode != Mode::Host {
        return None;
    }
    let name = run(
        &nvidia_smi_path()?,
        &["--query-gpu=name", "--format=csv,noheader"],
    )
    .await?;
    Some(name.lines().take(4).collect::<Vec<_>>().join(", "))
}

/// Read whole-device load and framebuffer memory without requesting model work.
pub async fn gpu_metrics() -> Option<GpuMetrics> {
    #[cfg(target_os = "android")]
    {
        None
    }
    #[cfg(not(target_os = "android"))]
    {
        use std::process::Stdio;
        use tokio::io::AsyncReadExt;

        let mut command = Command::new(nvidia_smi_path()?);
        command
            .args([
                "--query-gpu=index,utilization.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.as_std_mut().creation_flags(0x08000000);
        }
        let mut child = command.spawn().ok()?;
        let stdout = child.stdout.take()?;
        tokio::time::timeout(Duration::from_secs(4), async {
            let mut bytes = Vec::new();
            stdout
                .take(4 * 1024 + 1)
                .read_to_end(&mut bytes)
                .await
                .ok()?;
            if bytes.len() > 4 * 1024 || !child.wait().await.ok()?.success() {
                return None;
            }
            parse_gpu_metrics(std::str::from_utf8(&bytes).ok()?)
        })
        .await
        .ok()?
    }
}

#[cfg(any(test, not(target_os = "android")))]
fn parse_gpu_metrics(text: &str) -> Option<GpuMetrics> {
    fn number<T: std::str::FromStr>(value: &str) -> Option<Option<T>> {
        match value.trim() {
            "N/A" | "[N/A]" | "[Not Supported]" => Some(None),
            value => value.parse().ok().map(Some),
        }
    }
    let mut devices = Vec::new();
    for line in text.lines() {
        let columns: Vec<_> = line.split(',').map(str::trim).collect();
        if columns.len() != 4 || devices.len() >= 64 {
            return None;
        }
        devices.push(GpuReading {
            index: columns[0].parse().ok()?,
            load_percent: number(columns[1])?,
            memory_used_mib: number(columns[2])?,
            memory_total_mib: number(columns[3])?,
        });
    }
    let metrics = GpuMetrics {
        sample_age_ms: 0,
        devices,
    };
    metrics.is_valid().then_some(metrics)
}

fn status_check(json: &Value) -> Check {
    let state = json
        .get("BackendState")
        .and_then(Value::as_str)
        .unwrap_or("Unknown");
    let online = json.pointer("/Self/Online").and_then(Value::as_bool);
    if state == "Running" && online == Some(true) {
        Check::new("tailscale", "Tailscale", State::Ok, "Active",
            "Tailscale reports the server online. Peer access still depends on your tailnet policy.")
    } else if state == "Running" && online.is_none() {
        Check::new(
            "tailscale",
            "Tailscale",
            State::Unknown,
            "Unverified",
            "Tailscale is running, but it did not report whether the server is online.",
        )
    } else {
        Check::new(
            "tailscale",
            "Tailscale",
            State::Warning,
            "Disconnected",
            format!("Tailscale state: {state}. The server is not confirmed online."),
        )
        .help("Open Tailscale and connect. Sign in again if its session has expired.")
    }
}

pub(crate) async fn inspect_local(mode: Mode) -> Local {
    #[cfg(target_os = "android")]
    {
        let _ = mode;
        Local {
            tailscale: Check::new("tailscale", "Tailscale", State::Unknown, "Check in app",
                "Android keeps Tailscale's status private. Server reachability is checked separately.")
                .help("Open the Tailscale app and confirm it is connected."),
            addresses: vec![], serve: None, gpu: None,
        }
    }
    #[cfg(not(target_os = "android"))]
    {
        let Some(path) = tailscale_path() else {
            return Local {
                tailscale: Check::new("tailscale", "Tailscale", State::Unknown, "Not found",
                    "The Tailscale command-line tool was not found in a standard install location.")
                    .help("Install Tailscale or use its app to check the connection. Server checks still work."),
                addresses: vec![], serve: None, gpu: gpu_name(mode).await,
            };
        };
        let serving = async {
            if mode == Mode::Host {
                run(&path, &["serve", "status", "--json"])
                    .await
                    .and_then(|text| serde_json::from_str(&text).ok())
            } else {
                None
            }
        };
        let (status, serve, gpu) =
            tokio::join!(run(&path, &["status", "--json"]), serving, gpu_name(mode));
        let status = status.and_then(|text| serde_json::from_str::<Value>(&text).ok());
        match status {
            Some(json) => Local {
                tailscale: status_check(&json),
                addresses: json.get("TailscaleIPs").and_then(Value::as_array).map(|ips| {
                    ips.iter().filter_map(Value::as_str).filter(|ip| ip.parse::<std::net::Ipv4Addr>().is_ok()).map(str::to_owned).collect()
                }).unwrap_or_default(),
                serve, gpu,
            },
            None => Local {
                tailscale: Check::new("tailscale", "Tailscale", State::Unknown, "Unverified",
                    "The Tailscale command did not return a readable status.")
                    .help("Open Tailscale to check its connection. The app may need permission to read its local status."),
                addresses: vec![], serve, gpu,
            },
        }
    }
}

fn forward_matches(target: &str, base: &Url) -> bool {
    let raw = if target.starts_with("tcp://") {
        target.to_owned()
    } else {
        format!("tcp://{target}")
    };
    let Ok(target) = Url::parse(&raw) else {
        return false;
    };
    let host = target.host_str().unwrap_or("").trim_matches(['[', ']']);
    let target_local = host == "localhost"
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback());
    target_local && target.port() == base.port_or_known_default()
}

fn matching_forward_port(serve: &Value, base: &Url) -> Option<u16> {
    serve
        .get("TCP")?
        .as_object()?
        .iter()
        .find_map(|(port, config)| {
            let target = config.get("TCPForward")?.as_str()?;
            forward_matches(target, base)
                .then(|| port.parse::<u16>().ok().filter(|port| *port > 0))
                .flatten()
        })
}

pub(crate) fn external_endpoint(local: &Local, base: &Url) -> Option<String> {
    let port = matching_forward_port(local.serve.as_ref()?, base)?;
    let address = local
        .addresses
        .iter()
        .find_map(|address| address.parse::<std::net::Ipv4Addr>().ok())?;
    let mut external = base.clone();
    external.set_host(Some(&address.to_string())).ok()?;
    external.set_port(Some(port)).ok()?;
    Some(external.as_str().trim_end_matches('/').to_owned())
}

pub(crate) async fn check_forwarding(local: &Local, base: &Url, client: &Client) -> Check {
    let Some(serve) = &local.serve else {
        return Check::new(
            "forwarding",
            "Forwarding",
            State::Unknown,
            "Unverified",
            "The host's Tailscale forwarding configuration could not be read.",
        );
    };
    let found = matching_forward_port(serve, base);
    let Some(port) = found else {
        return Check::new(
            "forwarding",
            "Forwarding",
            State::Warning,
            "Not configured",
            "No Tailscale TCP forward to this local Ollama port was found.",
        )
        .help("Use the repository's Tailscale Serve setup instructions on this PC.");
    };
    let Some(ip) = local.addresses.first() else {
        return Check::new("forwarding", "Forwarding", State::Unknown, "Configured",
            "A matching TCP forward exists, but no Tailscale IPv4 address was available to test it.");
    };
    let remote =
        Url::parse(&format!("{}://{ip}:{port}", base.scheme())).expect("IP and port are validated");
    let result = get_json(client, &remote, "api/version").await;
    if super::parse_version(&result).is_ok() {
        Check::new("forwarding", "Forwarding", State::Ok, "Active",
            format!("Port {port} forwards to Ollama, and a check through the server's Tailscale address succeeded."))
            .help("This local check does not prove access from every peer. Check from another device before traveling.")
    } else {
        Check::new(
            "forwarding",
            "Forwarding",
            State::Warning,
            "Not responding",
            "A matching forward is configured, but the Ollama check through it failed.",
        )
        .help("Check Tailscale connectivity, Serve configuration, and the local Ollama endpoint.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn gpu_readings_distinguish_real_zero_from_unsupported_fields() {
        let zero = parse_gpu_metrics("0, 0, 0, 49152\r\n").unwrap();
        assert_eq!(zero.activity(), Some(false));
        assert_eq!(zero.devices[0].memory_used_mib, Some(0));
        assert_eq!(zero.devices[0].memory_total_mib, Some(49152));
        let busy = parse_gpu_metrics("0, 100, 4096, 49152\n1, 0, 0, 8192").unwrap();
        assert_eq!(busy.activity(), Some(true));
        assert_eq!(busy.devices[1].index, 1);
        let unknown = parse_gpu_metrics("0, [N/A], N/A, 49152").unwrap();
        assert_eq!(unknown.activity(), None);
        assert_eq!(unknown.devices[0].memory_used_mib, None);
        assert_eq!(
            parse_gpu_metrics("0, 5, [Not Supported], N/A")
                .unwrap()
                .activity(),
            Some(true)
        );
        assert_eq!(
            parse_gpu_metrics("0, 4, 100, 8192\n1, N/A, N/A, N/A")
                .unwrap()
                .activity(),
            None
        );
    }

    #[test]
    fn gpu_readings_reject_malformed_or_unbounded_driver_output() {
        for invalid in [
            "",
            "N/A",
            "0, 5%, 1, 2",
            "0, -1, 1, 2",
            "0, 101, 1, 2",
            "0, 5, 3, 2",
            "0, 0, 0, 0",
            "0, 0, 1",
            "0, 0, 1, 2, 3",
            "0, 0, 1, 2\n0, 1, 1, 2",
            "1024, 0, 1, 2",
            "0, 0, 1, 16777217",
        ] {
            assert_eq!(parse_gpu_metrics(invalid), None, "{invalid}");
        }
        assert_eq!(
            parse_gpu_metrics(
                &(0..65)
                    .map(|index| format!("{index}, 0, 1, 2\n"))
                    .collect::<String>()
            ),
            None
        );
    }

    #[test]
    fn daemon_running_without_online_evidence_is_not_connected() {
        assert_eq!(
            status_check(&json!({"BackendState":"Running","Self":{"Online":true}})).state,
            State::Ok
        );
        assert_eq!(
            status_check(&json!({"BackendState":"Running","Self":{"Online":false}})).state,
            State::Warning
        );
        assert_eq!(
            status_check(&json!({"BackendState":"Running"})).state,
            State::Unknown
        );
        assert_eq!(
            status_check(&json!({"BackendState":"NeedsLogin"})).label,
            "Disconnected"
        );
    }

    #[test]
    fn external_url_uses_the_advertised_address_and_matching_serve_port() {
        let base = Url::parse("http://127.0.0.1:11434").unwrap();
        let mut local = Local {
            tailscale: status_check(&json!({"BackendState":"Running","Self":{"Online":true}})),
            addresses: vec!["192.0.2.10".into()],
            serve: Some(json!({"TCP":{
                "21434":{"TCPForward":"127.0.0.1:11434"},
                "11435":{"TCPForward":"127.0.0.1:11435"}
            }})),
            gpu: None,
        };
        assert_eq!(
            external_endpoint(&local, &base).as_deref(),
            Some("http://192.0.2.10:21434")
        );
        assert_eq!(local.tailscale.label, "Active");
        assert_eq!(base.as_str(), "http://127.0.0.1:11434/");
        local.serve = Some(json!({"TCP":{"11435":{"TCPForward":"127.0.0.1:11435"}}}));
        assert!(external_endpoint(&local, &base).is_none());
        local.serve = None;
        assert!(external_endpoint(&local, &base).is_none());
        local.serve = Some(json!({"TCP":{"0":{"TCPForward":"127.0.0.1:11434"}}}));
        assert!(external_endpoint(&local, &base).is_none());
        local.serve = Some(json!({"TCP":{"11434":{"TCPForward":"127.0.0.1:11434"}}}));
        local.addresses.clear();
        assert!(external_endpoint(&local, &base).is_none());
    }

    #[test]
    fn forwarding_must_target_the_same_local_port() {
        let base = Url::parse("http://127.0.0.1:11434").unwrap();
        assert!(forward_matches("127.0.0.1:11434", &base));
        assert!(forward_matches("tcp://localhost:11434", &base));
        assert!(!forward_matches("127.0.0.1:11435", &base));
        assert!(!forward_matches("192.0.2.10:11434", &base));
    }
}
