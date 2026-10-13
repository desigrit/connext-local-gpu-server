use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CompanionApp {
    Tailscale,
    Ollama,
}

impl CompanionApp {
    fn name(self) -> &'static str {
        match self {
            Self::Tailscale => "Tailscale",
            Self::Ollama => "Ollama",
        }
    }
}

#[cfg(any(target_os = "windows", test))]
fn windows_candidates(
    target: CompanionApp,
    local_data: Option<std::path::PathBuf>,
    program_files: impl IntoIterator<Item = std::path::PathBuf>,
) -> Vec<std::path::PathBuf> {
    let mut candidates = Vec::new();
    if let (CompanionApp::Ollama, Some(local_data)) = (target, local_data) {
        if local_data.is_absolute() {
            candidates.push(
                local_data
                    .join("Programs")
                    .join("Ollama")
                    .join("ollama app.exe"),
            );
        }
    }
    for root in program_files {
        if root.is_absolute() {
            candidates.push(match target {
                CompanionApp::Tailscale => root.join("Tailscale").join("tailscale-ipn.exe"),
                CompanionApp::Ollama => root.join("Ollama").join("ollama app.exe"),
            });
        }
    }
    candidates
}

#[cfg(target_os = "windows")]
pub async fn open(app: &tauri::AppHandle, target: CompanionApp) -> Result<String, String> {
    use std::{
        os::windows::process::CommandExt,
        process::{Command, Stdio},
    };
    use tauri::Manager;

    let candidates = windows_candidates(
        target,
        app.path().local_data_dir().ok(),
        ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"]
            .into_iter()
            .filter_map(std::env::var_os)
            .map(std::path::PathBuf::from),
    );
    let executable = candidates.into_iter().find(|path| path.is_file()).ok_or_else(|| {
        format!(
            "{} was not found in the usual install folders on this PC. Open it from Start, or install its Windows desktop app.",
            target.name()
        )
    })?;
    // Only the two fixed GUI filenames are reachable from the enum above.
    // No shell, PATH lookup, model argument, or server command is involved.
    Command::new(&executable)
        .current_dir(
            executable
                .parent()
                .ok_or("The installed app folder is unavailable.")?,
        )
        .creation_flags(0x08000000)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| {
            format!(
                "Windows could not open {}. Try opening it from Start.",
                target.name()
            )
        })?;
    Ok(match target {
        CompanionApp::Tailscale => "Opening Tailscale. Check the system tray.",
        CompanionApp::Ollama => "Opening Ollama. Check the system tray.",
    }
    .into())
}

#[cfg(target_os = "macos")]
pub async fn open(_app: &tauri::AppHandle, target: CompanionApp) -> Result<String, String> {
    use std::{process::Stdio, time::Duration};

    // Launch Services resolves the installed bundle for this fixed app name.
    let mut command = tokio::process::Command::new("/usr/bin/open");
    command
        .args(["-a", target.name()])
        .kill_on_drop(true)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let status = tokio::time::timeout(Duration::from_secs(5), command.status())
        .await
        .map_err(|_| {
            format!(
                "Opening {} took too long. Open it from Applications.",
                target.name()
            )
        })?
        .map_err(|_| {
            format!(
                "macOS could not open {}. Open it from Applications.",
                target.name()
            )
        })?;
    if !status.success() {
        return Err(format!(
            "{} is not available on this Mac. Open it from Applications, or install its macOS app.",
            target.name()
        ));
    }
    Ok(match target {
        CompanionApp::Tailscale => "Opening Tailscale. Check the menu bar.",
        CompanionApp::Ollama => "Opening Ollama on this Mac.",
    }
    .into())
}

#[cfg(target_os = "android")]
pub async fn open(app: &tauri::AppHandle, target: CompanionApp) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;

    match target {
        CompanionApp::Tailscale => {
            // Tailscale's navigation-only link opens its device list, without
            // changing VPN state. The frontend cannot supply a URL.
            app.opener()
                .open_url("tailscale://navigate/main/devices", None::<&str>)
                .map_err(|_| "Could not open Tailscale on this device. Open it from your app drawer, or install or update the official Tailscale app.".to_string())?;
            Ok("Opening Tailscale on this device.".into())
        }
        CompanionApp::Ollama => Err("Ollama's desktop app is not available on Android. Open it on your GPU PC; Shambu can still check that server from this device.".into()),
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "android")))]
pub async fn open(_app: &tauri::AppHandle, target: CompanionApp) -> Result<String, String> {
    Err(format!("Open {} using this device's app launcher. Direct opening is supported on Windows, macOS, and Android for Tailscale.", target.name()))
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Availability {
    #[cfg(not(target_os = "android"))]
    Installed,
    #[cfg(not(target_os = "android"))]
    Missing,
    #[cfg(not(target_os = "windows"))]
    Unknown,
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Unsupported,
}

pub async fn availability(app: &tauri::AppHandle, target: CompanionApp) -> Availability {
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        if windows_candidates(
            target,
            app.path().local_data_dir().ok(),
            ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"]
                .into_iter()
                .filter_map(std::env::var_os)
                .map(std::path::PathBuf::from),
        )
        .iter()
        .any(|path| path.is_file())
        {
            Availability::Installed
        } else {
            Availability::Missing
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            tokio::process::Command::new("/usr/bin/open")
                .args(["-Ra", target.name()])
                .kill_on_drop(true)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status(),
        )
        .await;
        match result {
            Ok(Ok(status)) if status.success() => Availability::Installed,
            Ok(Ok(_)) => Availability::Missing,
            _ => Availability::Unknown,
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = app;
        match target {
            CompanionApp::Ollama => Availability::Unsupported,
            CompanionApp::Tailscale => Availability::Unknown,
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "android")))]
    {
        let _ = (app, target);
        Availability::Unsupported
    }
}

pub async fn install(app: &tauri::AppHandle, target: CompanionApp) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;
    #[cfg(target_os = "windows")]
    {
        use tauri::Manager;
        let winget = app
            .path()
            .local_data_dir()
            .map_err(|_| "Cannot find Windows App Installer.")?
            .join("Microsoft/WindowsApps/winget.exe");
        if winget.is_file() {
            let package = match target {
                CompanionApp::Ollama => "Ollama.Ollama",
                CompanionApp::Tailscale => "Tailscale.Tailscale",
            };
            // Fixed official package IDs only. Winget verifies the installer hash; the
            // standard installer owns elevation and consent. Never invoke a shell.
            let status = tokio::time::timeout(
                std::time::Duration::from_secs(1800),
                tokio::process::Command::new(winget)
                    .args([
                        "install",
                        "--id",
                        package,
                        "--exact",
                        "--source",
                        "winget",
                        "--interactive",
                        "--accept-source-agreements",
                        "--accept-package-agreements",
                        "--disable-interactivity",
                    ])
                    .creation_flags(0x08000000)
                    .kill_on_drop(true)
                    .stdin(std::process::Stdio::null())
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status(),
            )
            .await
            .map_err(|_| "Installation timed out. Check the installer, then try again.")?
            .map_err(|_| "Could not start the installer. Try the official download.")?;
            if !status.success() {
                return Err(
                    "Installation did not finish. Retry, or use the official download.".into(),
                );
            }
            return Ok(format!(
                "{} installed. Open it to finish setup.",
                target.name()
            ));
        }
    }
    let url = official_download(target)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "Could not open the official download. Try your browser.")?;
    Ok(format!("Opening the official {} download.", target.name()))
}

fn official_download(target: CompanionApp) -> Result<&'static str, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(match target {
            CompanionApp::Ollama => "https://ollama.com/download/windows",
            CompanionApp::Tailscale => "https://tailscale.com/download/windows",
        })
    }
    #[cfg(target_os = "macos")]
    {
        Ok(match target {
            CompanionApp::Ollama => "https://ollama.com/download/mac",
            CompanionApp::Tailscale => "https://tailscale.com/download/mac",
        })
    }
    #[cfg(target_os = "android")]
    {
        match target {
            CompanionApp::Tailscale => {
                Ok("https://play.google.com/store/apps/details?id=com.tailscale.ipn")
            }
            CompanionApp::Ollama => {
                Err("Install Ollama on your GPU PC. Android connects to it remotely.".into())
            }
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "android")))]
    {
        let _ = target;
        Err("Use the official app download for your operating system.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_app_ids_deserialize() {
        assert_eq!(
            serde_json::from_str::<CompanionApp>("\"tailscale\"").unwrap(),
            CompanionApp::Tailscale
        );
        assert_eq!(
            serde_json::from_str::<CompanionApp>("\"ollama\"").unwrap(),
            CompanionApp::Ollama
        );
        for value in [
            "\"powershell\"",
            "\"ollama serve\"",
            "\"https://example.com\"",
            "\"tailscale; calc\"",
            "\"../ollama\"",
            "{\"url\":\"tailscale://navigate\"}",
            "null",
        ] {
            assert!(
                serde_json::from_str::<CompanionApp>(value).is_err(),
                "{value}"
            );
        }
    }

    #[test]
    fn windows_candidates_select_only_gui_executables() {
        let base = std::env::temp_dir();
        let local = base.join("local");
        let programs = base.join("programs");
        let ollama = windows_candidates(
            CompanionApp::Ollama,
            Some(local.clone()),
            [programs.clone()],
        );
        assert_eq!(
            ollama,
            vec![
                local.join("Programs").join("Ollama").join("ollama app.exe"),
                programs.join("Ollama").join("ollama app.exe"),
            ]
        );
        let tailscale =
            windows_candidates(CompanionApp::Tailscale, Some(local), [programs.clone()]);
        assert_eq!(
            tailscale,
            vec![programs.join("Tailscale").join("tailscale-ipn.exe")]
        );
    }

    #[test]
    fn missing_or_relative_install_roots_do_not_search_the_current_directory() {
        assert!(windows_candidates(
            CompanionApp::Ollama,
            Some(std::path::PathBuf::from("relative")),
            [std::path::PathBuf::from("relative-programs")]
        )
        .is_empty());
        assert!(windows_candidates(CompanionApp::Tailscale, None, []).is_empty());
    }
}
