use readiness::{Mode, Settings, PROTOCOL_VERSION};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Config {
    pub protocol_version: u32,
    pub endpoint: String,
    pub pairing_key: String,
}

/// The desktop app owns the name. Read only these three fields from its saved connection.
/// Refreshing it on every sample also works while the app is closed or Windows is signed out.
pub fn server_name(endpoint: &str) -> Option<String> {
    let path = dirs::config_dir()?
        .join("com.desigrit.shambu")
        .join("connection.json");
    read_server_name(&path, endpoint)
}

fn read_server_name(path: &Path, endpoint: &str) -> Option<String> {
    #[derive(Deserialize)]
    struct Profile {
        mode: Mode,
        endpoint: String,
        name: String,
    }
    let metadata = fs::symlink_metadata(path).ok()?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 16 * 1024 {
        return None;
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .ok()?
        .take(16 * 1024 + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() > 16 * 1024 {
        return None;
    }
    let profile: Profile = serde_json::from_slice(&bytes).ok()?;
    if profile.mode != Mode::Host {
        return None;
    }
    let settings = Settings {
        mode: Mode::Host,
        endpoint: profile.endpoint,
        name: profile.name,
        ..Settings::default()
    };
    let saved = readiness::validate_settings(&settings).ok()?;
    let expected = readiness::validate_settings(&Settings {
        mode: Mode::Host,
        endpoint: endpoint.into(),
        ..Settings::default()
    })
    .ok()?;
    // Both URLs have been restricted to loopback. Treat localhost and 127.0.0.1 alike.
    if saved.scheme() != expected.scheme()
        || saved.port_or_known_default() != expected.port_or_known_default()
    {
        return None;
    }
    readiness::normalize_server_name(&settings.name)
}

impl Config {
    pub fn settings(&self) -> Result<Settings, String> {
        if self.protocol_version != PROTOCOL_VERSION
            || !readiness::valid_pairing_key(&self.pairing_key)
        {
            return Err("The host companion configuration is invalid or unsupported.".into());
        }
        let settings = Settings {
            mode: Mode::Host,
            endpoint: self.endpoint.clone(),
            name: "GPU server".into(),
            ..Settings::default()
        };
        readiness::validate_settings(&settings)?;
        Ok(settings)
    }
}

pub fn default_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let directory = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    #[cfg(target_os = "macos")]
    let directory = std::env::var_os("HOME").map(|home| {
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
    });
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let directory = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")));
    let directory =
        directory.ok_or("The current account's private configuration directory is unavailable.")?;
    if !directory.is_absolute() {
        return Err("The private configuration directory must be an absolute path.".into());
    }
    Ok(directory.join("Shambu").join("agent").join("config.json"))
}

pub fn load(path: &Path) -> Result<Config, String> {
    let metadata = fs::symlink_metadata(path).map_err(|_| {
        "The private companion configuration is missing. Run shambu-agent --init first."
    })?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 16 * 1024 {
        return Err("The private companion configuration is not a regular, supported file.".into());
    }
    let bytes =
        fs::read(path).map_err(|_| "The private companion configuration could not be read.")?;
    let config: Config = serde_json::from_slice(&bytes)
        .map_err(|_| "The private companion configuration is not valid JSON.")?;
    config.settings()?;
    Ok(config)
}

pub fn initialize(path: &Path, endpoint: &str) -> Result<(), String> {
    let settings = Settings {
        mode: Mode::Host,
        endpoint: endpoint.into(),
        ..Settings::default()
    };
    let url = readiness::validate_settings(&settings)?;
    if path.exists() {
        return Err(
            "A private configuration already exists. Its pairing key was preserved.".into(),
        );
    }
    let parent = path
        .parent()
        .ok_or("The private configuration directory is invalid.")?;
    fs::create_dir_all(parent)
        .map_err(|_| "Could not create the private configuration directory.")?;
    if fs::symlink_metadata(parent)
        .map_err(|_| "Could not inspect the private directory.")?
        .file_type()
        .is_symlink()
    {
        return Err("The private configuration directory must not be a symbolic link.".into());
    }
    secure_directory(parent)?;
    let mut entropy = [0; 32];
    getrandom::fill(&mut entropy).map_err(|_| "Secure random key generation failed.")?;
    let pairing_key: String = entropy.iter().map(|byte| format!("{byte:02x}")).collect();
    let config = Config {
        protocol_version: PROTOCOL_VERSION,
        endpoint: url.as_str().trim_end_matches('/').into(),
        pairing_key,
    };
    let bytes = serde_json::to_vec_pretty(&config)
        .map_err(|_| "Could not encode the private companion configuration.")?;
    let mut options = fs::OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    // The Windows parent already has a protected inheritable DACL before key bytes exist.
    let mut file = options
        .open(path)
        .map_err(|_| "Could not create the private companion configuration.")?;
    if let Err(error) = file.write_all(&bytes).and_then(|_| file.sync_all()) {
        drop(file);
        let _ = fs::remove_file(path);
        let _ = error;
        return Err("Could not write the private companion configuration.".into());
    }
    Ok(())
}

#[cfg(unix)]
pub(crate) fn secure_directory(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|_| "Could not protect the private companion directory.".into())
}

#[cfg(windows)]
pub(crate) fn secure_directory(path: &Path) -> Result<(), String> {
    use std::{os::windows::ffi::OsStrExt, ptr};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, LocalFree},
        Security::{
            Authorization::{
                ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
            },
            GetTokenInformation, SetFileSecurityW, TokenUser, DACL_SECURITY_INFORMATION,
            PROTECTED_DACL_SECURITY_INFORMATION, TOKEN_QUERY, TOKEN_USER,
        },
        System::Threading::{GetCurrentProcess, OpenProcessToken},
    };
    unsafe {
        let mut token = ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return Err("Could not identify the current account for private storage.".into());
        }
        let mut needed = 0;
        GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut needed);
        if needed == 0 || needed > 64 * 1024 {
            CloseHandle(token);
            return Err("Could not read the current account identity.".into());
        }
        let mut token_data = vec![0u8; needed as usize];
        let success = GetTokenInformation(
            token,
            TokenUser,
            token_data.as_mut_ptr().cast(),
            needed,
            &mut needed,
        );
        CloseHandle(token);
        if success == 0 {
            return Err("Could not read the current account identity.".into());
        }
        let token_user = ptr::read_unaligned(token_data.as_ptr().cast::<TOKEN_USER>());
        let mut sid_text = ptr::null_mut();
        if ConvertSidToStringSidW(token_user.User.Sid, &mut sid_text) == 0 {
            return Err("Could not format the current account identity.".into());
        }
        let mut length = 0;
        while *sid_text.add(length) != 0 {
            length += 1;
        }
        let sid = String::from_utf16_lossy(std::slice::from_raw_parts(sid_text, length));
        LocalFree(sid_text.cast());
        // Give only this user and SYSTEM inherited access, including files created while elevated.
        let descriptor_text: Vec<u16> = format!("D:P(A;OICI;FA;;;{sid})(A;OICI;FA;;;SY)")
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let mut descriptor = ptr::null_mut();
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(
            descriptor_text.as_ptr(),
            1,
            &mut descriptor,
            ptr::null_mut(),
        ) == 0
        {
            return Err("Could not prepare private directory permissions.".into());
        }
        let filename: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        let success = SetFileSecurityW(
            filename.as_ptr(),
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            descriptor,
        );
        LocalFree(descriptor);
        if success == 0 {
            return Err("Could not protect the private companion directory.".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialization_is_private_and_does_not_overwrite_a_pairing_key() {
        let mut entropy = [0; 8];
        getrandom::fill(&mut entropy).unwrap();
        let suffix: String = entropy.iter().map(|byte| format!("{byte:02x}")).collect();
        let directory = std::env::temp_dir().join(format!("shambu-agent-test-{suffix}"));
        let path = directory.join("config.json");
        {
            initialize(&path, "http://127.0.0.1:11434").unwrap();
            let config = load(&path).unwrap();
            assert_eq!(config.pairing_key.len(), 64);
            assert!(readiness::valid_pairing_key(&config.pairing_key));
            let before = fs::read(&path).unwrap();
            assert!(initialize(&path, "http://127.0.0.1:11434").is_err());
            assert_eq!(before, fs::read(&path).unwrap());
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                assert_eq!(
                    fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                    0o600
                );
            }
        };
        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(&directory);
    }

    #[test]
    fn name_tracks_saved_host_settings_and_ignores_other_connections() {
        let path = std::env::temp_dir().join(format!("shambu-name-{}.json", std::process::id()));
        let mut profile = serde_json::json!({
            "mode": "host", "endpoint": "http://localhost:11434/", "name": "  Jungle PC  ",
            "diagnosticsKey": "ignored"
        });
        fs::write(&path, profile.to_string()).unwrap();
        assert_eq!(
            read_server_name(&path, "http://127.0.0.1:11434").as_deref(),
            Some("Jungle PC")
        );
        profile["name"] = serde_json::json!("Renamed PC");
        fs::write(&path, profile.to_string()).unwrap();
        assert_eq!(
            read_server_name(&path, "http://127.0.0.1:11434").as_deref(),
            Some("Renamed PC")
        );
        assert!(read_server_name(&path, "http://127.0.0.1:12345").is_none());
        profile["mode"] = serde_json::json!("remote");
        fs::write(&path, profile.to_string()).unwrap();
        assert!(read_server_name(&path, "http://127.0.0.1:11434").is_none());
        fs::write(&path, "invalid").unwrap();
        assert!(read_server_name(&path, "http://127.0.0.1:11434").is_none());
        fs::write(&path, vec![b' '; 16 * 1024 + 1]).unwrap();
        assert!(read_server_name(&path, "http://127.0.0.1:11434").is_none());
        fs::remove_file(&path).unwrap();
        assert!(read_server_name(&path, "http://127.0.0.1:11434").is_none());
    }

    #[test]
    fn host_config_cannot_probe_remote_addresses() {
        let config = Config {
            protocol_version: 1,
            endpoint: "http://192.0.2.1:11434".into(),
            pairing_key: "a".repeat(64),
        };
        assert!(config.settings().is_err());
    }
}
