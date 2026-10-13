mod launcher;
#[cfg(desktop)]
mod native_window;

use readiness::{Settings, Snapshot};
use std::{fs, path::PathBuf};
use tauri::{Manager, State};
use tokio::sync::Mutex;

struct AppState {
    config_path: PathBuf,
    probe_lock: Mutex<()>,
}

#[tauri::command]
fn load_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    match fs::read_to_string(&state.config_path) {
        Ok(text) => serde_json::from_str(&text)
            .map_err(|_| "Saved settings could not be read. Enter the connection again.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(_) => {
            Err("Saved settings could not be opened. Check this app's storage permissions.".into())
        }
    }
}

#[tauri::command]
fn save_settings(settings: Settings, state: State<'_, AppState>) -> Result<Settings, String> {
    let url = readiness::validate_settings(&settings)?;
    let settings = Settings {
        endpoint: url.as_str().trim_end_matches('/').into(),
        name: settings.name.trim().into(),
        ..settings
    };
    let directory = state
        .config_path
        .parent()
        .ok_or("App storage is unavailable.")?;
    fs::create_dir_all(directory).map_err(|_| "Could not create the app settings folder.")?;
    let text =
        serde_json::to_vec_pretty(&settings).map_err(|_| "Could not encode the settings.")?;
    // Only user-entered connection settings are saved. Probe results never go to disk.
    fs::write(&state.config_path, text).map_err(|_| "Could not save the connection settings.")?;
    Ok(settings)
}

#[tauri::command]
async fn check_readiness(
    app: tauri::AppHandle,
    settings: Settings,
    state: State<'_, AppState>,
) -> Result<Snapshot, String> {
    let _guard = state
        .probe_lock
        .try_lock()
        .map_err(|_| "A check is already in progress.")?;
    let mut snapshot = readiness::inspect(settings).await?;
    if snapshot.mode == readiness::Mode::Host {
        if let Ok(key) = get_host_pairing_key(app) {
            snapshot.gpu_history = readiness::local_gpu_history(&key).await;
        }
    }
    Ok(snapshot)
}

#[tauri::command]
fn get_host_pairing_key(app: tauri::AppHandle) -> Result<String, String> {
    use std::io::Read;
    let path = app
        .path()
        .local_data_dir()
        .map_err(|_| "App storage is unavailable.")?
        .join("Shambu")
        .join("agent")
        .join("config.json");
    let file = fs::File::open(path)
        .map_err(|_| "Set up the Shambu host companion on this PC first. See the host-agent guide in the repository.")?;
    let mut bytes = Vec::new();
    file.take(16 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read the host pairing configuration.")?;
    if bytes.len() > 16 * 1024 {
        return Err("The host configuration is invalid.".into());
    }
    let config: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "The host configuration is invalid.")?;
    if config
        .get("protocolVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(1)
    {
        return Err("The host configuration version is not supported.".into());
    }
    let key = config
        .get("pairingKey")
        .and_then(serde_json::Value::as_str)
        .filter(|key| {
            key.len() == 64
                && key
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        })
        .ok_or("The host pairing key is invalid.")?;
    Ok(key.to_owned())
}

#[tauri::command]
async fn open_companion_app(
    app: tauri::AppHandle,
    target: launcher::CompanionApp,
) -> Result<String, String> {
    launcher::open(&app, target).await
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "android")]
    let builder = builder.plugin(
        tauri_plugin_opener::Builder::new()
            .open_js_links_on_click(false)
            .build(),
    );
    #[cfg(desktop)]
    let builder = builder.on_window_event(native_window::on_window_event);
    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            #[cfg(desktop)]
            native_window::configure(app.handle());
            let config_path = app.path().app_config_dir()?.join("connection.json");
            app.manage(AppState {
                config_path,
                probe_lock: Mutex::new(()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            check_readiness,
            get_host_pairing_key,
            open_companion_app
        ])
        .run(tauri::generate_context!())
        .expect("Could not start Shambu");
}
