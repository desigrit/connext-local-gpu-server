use serde::Serialize;
#[cfg(desktop)]
use std::time::Duration;
use tauri::{ipc::Channel, AppHandle, State};
use tokio::sync::Mutex;

pub const FEED: &str =
    "https://github.com/desigrit/shambu/releases/download/update-feed/latest.json";
pub const PUBLIC_KEY: &str = include_str!("../updater.pub");

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

// No paths, URLs, keys, or installer arguments are accepted from the webview.
// The staged bytes stay private to this process until the user chooses Restart.
#[derive(Default)]
pub struct UpdateState(Mutex<Pending>);

#[derive(Default)]
struct Pending {
    #[cfg(desktop)]
    update: Option<tauri_plugin_updater::Update>,
    bytes: Option<Vec<u8>>,
}

pub fn validate_download_url(value: &str) -> Result<(), String> {
    let url = url::Url::parse(value).map_err(|_| "The update link is invalid.")?;
    if url.scheme() != "https"
        || url.host_str() != Some("github.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !url
            .path()
            .starts_with("/desigrit/shambu/releases/download/")
    {
        return Err("The update link is not a Shambu release.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn check_app_update(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<Option<UpdateInfo>, String> {
    let mut pending = state
        .0
        .try_lock()
        .map_err(|_| "An update is in progress.")?;
    // Rechecks must not throw away a verified download awaiting installation.
    if pending.bytes.is_some() {
        return Ok(pending.update.as_ref().map(|u| UpdateInfo {
            version: u.version.clone(),
        }));
    }
    #[cfg(desktop)]
    let update = {
        use tauri_plugin_updater::UpdaterExt;
        app.updater_builder()
            .endpoints(vec![FEED.parse().map_err(|_| "Invalid update feed.")?])
            .map_err(|_| "Could not prepare the update check.")?
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|_| "Could not prepare the update check.")?
            .check()
            .await
            .map_err(|_| "Could not check for updates. Try again later.")?
    };
    if let Some(ref update) = update {
        validate_download_url(update.download_url.as_str())?;
    }
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
    });
    pending.update = update;
    Ok(info)
}

#[tauri::command]
pub async fn download_app_update(
    state: State<'_, UpdateState>,
    on_progress: Channel<Progress>,
) -> Result<(), String> {
    let mut pending = state
        .0
        .try_lock()
        .map_err(|_| "An update is in progress.")?;
    if pending.bytes.is_some() {
        return Ok(());
    }
    let update = pending
        .update
        .as_ref()
        .ok_or("Check for an update first.")?;
    #[cfg(desktop)]
    let bytes = {
        let mut update = update.clone();
        update.timeout = Some(Duration::from_secs(600));
        let mut downloaded = 0;
        let mut last_sent = std::time::Instant::now();
        update
            .download(
                |chunk, total| {
                    downloaded += chunk as u64;
                    if last_sent.elapsed() >= Duration::from_millis(80) || total == Some(downloaded)
                    {
                        let _ = on_progress.send(Progress { downloaded, total });
                        last_sent = std::time::Instant::now();
                    }
                },
                || {},
            )
            .await
            .map_err(|_| "Download could not be verified. Check your connection and retry.")?
    };
    // download() resolves only after signature verification, not on its last chunk.
    pending.bytes = Some(bytes);
    Ok(())
}

#[tauri::command]
pub async fn install_app_update(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<(), String> {
    let pending = state
        .0
        .try_lock()
        .map_err(|_| "An update is in progress.")?;
    let update = pending
        .update
        .as_ref()
        .ok_or("Download the update first.")?;
    let bytes = pending.bytes.as_ref().ok_or("Download the update first.")?;
    #[cfg(desktop)]
    {
        // Windows starts its installer and exits here. That installer relaunches Shambu.
        // macOS replaces the bundle first, then restarts into the new executable.
        update.install(bytes).map_err(|_| {
            "Could not install the update. Close other Shambu windows and retry.".to_string()
        })?;
        app.restart();
    }
}

#[cfg(test)]
mod verification;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn updates_only_download_from_this_repositories_https_releases() {
        assert!(validate_download_url("https://github.com/desigrit/shambu/releases/download/v1.0.2/Shambu-Windows-x64-Setup.exe").is_ok());
        for url in [
            "http://github.com/desigrit/shambu/releases/download/v1/a.exe",
            "https://github.com.evil.example/desigrit/shambu/releases/download/v1/a.exe",
            "https://github.com/someone/shambu/releases/download/v1/a.exe",
            "https://user:password@github.com/desigrit/shambu/releases/download/v1/a.exe",
            "https://github.com/desigrit/shambu/releases/download/v1/a.exe?token=secret",
            "file:///tmp/update.exe",
        ] {
            assert!(validate_download_url(url).is_err(), "accepted {url}");
        }
    }
}
