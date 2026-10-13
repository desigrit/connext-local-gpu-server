use super::{validate_download_url, verification, Progress, FEED, PUBLIC_KEY};
use serde::Deserialize;
use std::{collections::HashMap, time::Duration};
use tauri::{ipc::Channel, plugin::PluginHandle, AppHandle, Manager, Wry};

#[derive(Deserialize)]
struct Manifest {
    version: String,
    platforms: HashMap<String, Artifact>,
}

#[derive(Deserialize)]
struct Artifact {
    url: url::Url,
    signature: String,
}

pub struct Release {
    pub version: String,
    pub download_url: url::Url,
    signature: String,
}

fn client(seconds: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(seconds))
        .user_agent(concat!("Shambu/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "Could not prepare the update check.".into())
}

async fn read_limited(
    url: url::Url,
    limit: usize,
    seconds: u64,
    progress: Option<Channel<Progress>>,
) -> Result<Vec<u8>, String> {
    let mut response = client(seconds)?
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|_| "Could not download the update. Check your connection and retry.")?;
    let total = response.content_length();
    if total.is_some_and(|size| size > limit as u64) {
        return Err("The update download is too large.".into());
    }
    let mut bytes = Vec::new();
    let mut last_sent = std::time::Instant::now();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Download interrupted. Retry the update.")?
    {
        if bytes.len() + chunk.len() > limit {
            return Err("The update download is too large.".into());
        }
        bytes.extend_from_slice(&chunk);
        if last_sent.elapsed() >= Duration::from_millis(80) || total == Some(bytes.len() as u64) {
            if let Some(ref progress) = progress {
                let _ = progress.send(Progress {
                    downloaded: bytes.len() as u64,
                    total,
                });
            }
            last_sent = std::time::Instant::now();
        }
    }
    Ok(bytes)
}

pub async fn check(app: &AppHandle) -> Result<Option<Release>, String> {
    let bytes = read_limited(
        FEED.parse().map_err(|_| "Invalid update feed.")?,
        256 * 1024,
        20,
        None,
    )
    .await?;
    let mut manifest: Manifest =
        serde_json::from_slice(&bytes).map_err(|_| "Could not read the update information.")?;
    let version =
        semver::Version::parse(&manifest.version).map_err(|_| "Invalid update version.")?;
    if version <= app.package_info().version || !version.pre.is_empty() {
        return Ok(None);
    }
    let artifact = manifest
        .platforms
        .remove("android-aarch64")
        .ok_or("No Android update is available.")?;
    validate_download_url(artifact.url.as_str())?;
    Ok(Some(Release {
        version: manifest.version,
        download_url: artifact.url,
        signature: artifact.signature,
    }))
}

pub async fn download(release: &Release, progress: Channel<Progress>) -> Result<Vec<u8>, String> {
    let bytes = read_limited(
        release.download_url.clone(),
        128 * 1024 * 1024,
        600,
        Some(progress),
    )
    .await?;
    verification::verify(&bytes, &release.signature, PUBLIC_KEY, &release.version)?;
    Ok(bytes)
}

struct Installer(PluginHandle<Wry>);

pub fn plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri::plugin::Builder::new("shambu-updates")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.desigrit.shambu", "UpdaterPlugin")?;
            app.manage(Installer(handle));
            Ok(())
        })
        .build()
}

pub async fn install(app: &AppHandle, release: &Release, bytes: &[u8]) -> Result<(), String> {
    // Reverify before handing the file to Android's package installer.
    verification::verify(bytes, &release.signature, PUBLIC_KEY, &release.version)?;
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|_| "Update storage is unavailable.")?
        .join("updates");
    std::fs::create_dir_all(&directory).map_err(|_| "Could not create update storage.")?;
    let path = directory.join("shambu-update.apk");
    std::fs::write(&path, bytes)
        .map_err(|_| "Could not save the update. Free some space and retry.")?;
    let response: serde_json::Value = app
        .state::<Installer>()
        .0
        .run_mobile_plugin_async("install", serde_json::json!({ "path": path }))
        .await
        .map_err(|_| "Could not open the Android installer. Try Install again.")?;
    if response
        .get("permissionNeeded")
        .and_then(serde_json::Value::as_bool)
        == Some(true)
    {
        return Err("Allow updates from Shambu, then tap Install again.".into());
    }
    Ok(())
}
