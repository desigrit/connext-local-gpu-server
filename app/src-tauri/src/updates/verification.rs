use base64::Engine;
use minisign_verify::{PublicKey, Signature};

pub fn verify(
    bytes: &[u8],
    signature: &str,
    public_key: &str,
    version: &str,
) -> Result<(), String> {
    let decode = |text: &str| -> Result<String, String> {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(text.trim())
            .map_err(|_| "The update signature is invalid.")?;
        String::from_utf8(decoded).map_err(|_| "The update signature is invalid.".into())
    };
    let key = PublicKey::decode(&decode(public_key)?).map_err(|_| "Invalid update public key.")?;
    let signature =
        Signature::decode(&decode(signature)?).map_err(|_| "The update signature is invalid.")?;
    key.verify(bytes, &signature, true)
        .map_err(|_| "The update could not be verified. Retry the download.")?;
    let signed_version = signature
        .trusted_comment()
        .split('\t')
        .find_map(|part| part.strip_prefix("version:"));
    if signed_version != Some(version) {
        return Err("The downloaded version does not match the update.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authentic_download_passes_but_tampering_or_wrong_version_does_not() {
        let bytes = include_bytes!("../../testdata/update.txt");
        let sig = include_str!("../../testdata/update.txt.sig");
        let key = include_str!("../../testdata/update.pub");
        assert!(verify(bytes, sig, key, "1.0.2").is_ok());
        assert!(verify(b"modified download", sig, key, "1.0.2").is_err());
        assert!(verify(bytes, sig, key, "9.9.9").is_err());
        assert!(verify(bytes, "not a signature", key, "1.0.2").is_err());
        assert!(verify(bytes, sig, super::super::PUBLIC_KEY, "1.0.2").is_err());
    }
}
