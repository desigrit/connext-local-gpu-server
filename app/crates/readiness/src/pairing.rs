use crate::{
    diagnostics_endpoint, http_client, read_json_response, valid_pairing_key, validate_settings,
    Mode, Settings,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCode {
    pub code: String,
    pub expires_at_ms: u64,
}

pub async fn create_pairing_code(key: &str) -> Result<PairingCode, String> {
    if !valid_pairing_key(key) {
        return Err("The host credential is invalid.".into());
    }
    let response = http_client()?
        .post("http://127.0.0.1:11435/pairing/new")
        .bearer_auth(key)
        .send()
        .await
        .map_err(|_| "The host companion is not running. Start it, then try again.")?;
    if response.status().as_u16() == 404 {
        return Err("Update the host companion to use short pairing codes.".into());
    }
    let code: PairingCode = serde_json::from_value(read_json_response(response).await?)
        .map_err(|_| "The host returned an invalid pairing code.")?;
    if !valid_code(&code.code) {
        return Err("The host returned an invalid pairing code.".into());
    }
    Ok(code)
}

pub fn valid_code(code: &str) -> bool {
    code.len() == 8
        && code
            .bytes()
            .all(|b| b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789".contains(&b))
}

pub async fn pair_host(mut settings: Settings, code: &str) -> Result<Settings, String> {
    if settings.mode != Mode::Remote {
        return Err("Choose Remote server to pair this device.".into());
    }
    if !valid_code(code) {
        return Err("Enter the 8-character code shown on your GPU PC.".into());
    }
    // Do not send a saved credential to a newly edited endpoint.
    settings.diagnostics_key.clear();
    let base = validate_settings(&settings)?;
    let endpoint = diagnostics_endpoint(&settings, &base)?
        .join("pairing")
        .map_err(|_| "The host address is invalid.")?;
    let response = http_client()?
        .post(endpoint)
        .json(&serde_json::json!({"code": code}))
        .send()
        .await
        .map_err(|_| "Cannot reach the host companion. Check Tailscale and the server address.")?;
    match response.status().as_u16() {
        401 | 403 => {
            return Err("Code expired or not accepted. Copy a fresh code from the GPU PC.".into())
        }
        429 => return Err("Too many attempts. Create a new code on the GPU PC.".into()),
        404 => return Err("Update the host companion to use short pairing codes.".into()),
        _ => {}
    }
    let value = read_json_response(response).await?;
    let key = value
        .get("key")
        .and_then(|v| v.as_str())
        .filter(|key| valid_pairing_key(key))
        .ok_or("The host returned an invalid credential.")?;
    settings.diagnostics_key = key.to_string();
    Ok(settings)
}
