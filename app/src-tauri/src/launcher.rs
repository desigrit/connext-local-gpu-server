use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CompanionApp {
    Tailscale,
    Ollama,
}

#[cfg(not(target_os = "android"))]
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
        CompanionApp::Tailscale => {
            "Opening Tailscale on this PC. Its controls may appear in the system tray."
        }
        CompanionApp::Ollama => {
            "Opening Ollama on this PC. If no window appears, check its system tray icon."
        }
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
        CompanionApp::Tailscale => {
            "Opening Tailscale on this Mac. Its controls may appear in the menu bar."
        }
        CompanionApp::Ollama => {
            "Opening Ollama on this Mac. This opens the local app, not the app on your GPU PC."
        }
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
