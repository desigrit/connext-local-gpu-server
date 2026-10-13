use crate::{get_json, Check, Mode, State};
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

/// Returns whether any NVIDIA GPU is at least 5% busy, without requesting model work.
pub async fn gpu_active() -> Option<bool> {
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
                "--query-gpu=utilization.gpu",
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
            parse_gpu_activity(std::str::from_utf8(&bytes).ok()?)
        })
        .await
        .ok()?
    }
}

#[cfg(any(test, not(target_os = "android")))]
fn parse_gpu_activity(text: &str) -> Option<bool> {
    let mut active = false;
    let mut count = 0;
    for line in text.lines() {
        let utilization: u8 = line.trim().parse().ok()?;
        count += 1;
        if utilization > 100 || count > 64 {
            return None;
        }
        active |= utilization >= 5;
    }
    (count > 0).then_some(active)
}

fn status_check(json: &Value) -> Check {
    let state = json
        .get("BackendState")
        .and_then(Value::as_str)
        .unwrap_or("Unknown");
    let online = json.pointer("/Self/Online").and_then(Value::as_bool);
    if state == "Running" && online == Some(true) {
        Check::new("tailscale", "Tailscale", State::Ok, "Connected",
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
    let ports = serve.get("TCP").and_then(Value::as_object);
    let found = ports.and_then(|ports| {
        ports.iter().find_map(|(port, config)| {
            let target = config.get("TCPForward").and_then(Value::as_str)?;
            if forward_matches(target, base) {
                port.parse::<u16>().ok()
            } else {
                None
            }
        })
    });
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
    fn gpu_activity_requires_bounded_numeric_driver_evidence() {
        assert_eq!(parse_gpu_activity("0\n4\n"), Some(false));
        assert_eq!(parse_gpu_activity(" 5 \r\n0\r\n"), Some(true));
        assert_eq!(parse_gpu_activity("100"), Some(true));
        for invalid in ["", "N/A", "5%", "-1", "101", "5\nN/A", "\n"] {
            assert_eq!(parse_gpu_activity(invalid), None);
        }
        assert_eq!(parse_gpu_activity(&"0\n".repeat(65)), None);
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
    fn forwarding_must_target_the_same_local_port() {
        let base = Url::parse("http://127.0.0.1:11434").unwrap();
        assert!(forward_matches("127.0.0.1:11434", &base));
        assert!(forward_matches("tcp://localhost:11434", &base));
        assert!(!forward_matches("127.0.0.1:11435", &base));
        assert!(!forward_matches("192.0.2.10:11434", &base));
    }
}
