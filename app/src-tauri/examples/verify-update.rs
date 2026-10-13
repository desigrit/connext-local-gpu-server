#[path = "../src/updates/verification.rs"]
mod verification;

const PUBLIC_KEY: &str = include_str!("../updater.pub");

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        return Err("Usage: verify-update MANIFEST ARTIFACT_DIRECTORY".into());
    }
    let manifest: serde_json::Value = serde_json::from_slice(&std::fs::read(&args[1])?)?;
    let version = manifest["version"].as_str().ok_or("Missing version")?;
    let platforms = manifest["platforms"]
        .as_object()
        .ok_or("Missing platforms")?;
    if platforms.len() != 3 {
        return Err("Expected three desktop update platforms".into());
    }
    for (platform, entry) in platforms {
        let url = url::Url::parse(entry["url"].as_str().ok_or("Missing URL")?)?;
        let name = url
            .path_segments()
            .and_then(|mut p| p.next_back())
            .ok_or("Missing filename")?;
        let bytes = std::fs::read(std::path::Path::new(&args[2]).join(name))?;
        verification::verify(
            &bytes,
            entry["signature"].as_str().ok_or("Missing signature")?,
            PUBLIC_KEY,
            version,
        )?;
        println!("Verified {platform} {version}");
    }
    Ok(())
}
