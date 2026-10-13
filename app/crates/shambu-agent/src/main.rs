use shambu_agent::{config, router, spawn_sampler, SnapshotCache, LISTEN_ADDRESS};

#[tokio::main]
async fn main() {
    if let Err(message) = run().await {
        // Errors are deliberately generic: never echo configuration, URLs, keys, or probe payloads.
        eprintln!("{message}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args == ["--help"] || args == ["-h"] {
        println!("Shambu host companion\n\nshambu-agent --init [--ollama-url http://127.0.0.1:11434]\nshambu-agent\n\nCreates a private pairing key, then serves read-only host checks on loopback port 11435.\nUse the Shambu app's Copy pairing key action to link your other devices.");
        return Ok(());
    }
    let path = config::default_path()?;
    if args.first().is_some_and(|value| value == "--init") {
        let endpoint = match args.as_slice() {
            [_] => "http://127.0.0.1:11434",
            [_, flag, endpoint] if flag == "--ollama-url" => endpoint,
            _ => return Err("Use shambu-agent --init [--ollama-url <loopback base URL>].".into()),
        };
        config::initialize(&path, endpoint)?;
        println!("Private companion configuration created. The pairing key was not printed.\nOpen Shambu on this PC and choose Copy pairing key when linking another device.");
        return Ok(());
    }
    if !args.is_empty() {
        return Err("Unrecognized arguments. Use shambu-agent --help.".into());
    }
    let config = config::load(&path)?;
    let settings = config.settings()?;
    let listener = tokio::net::TcpListener::bind(LISTEN_ADDRESS)
        .await
        .map_err(|_| {
            "Could not bind loopback port 11435. Check whether another companion is running."
        })?;
    let cache = SnapshotCache::default();
    let router = router(cache.clone(), &config.pairing_key)?;
    let sampler = spawn_sampler(cache, settings);
    println!("Shambu host companion is listening on loopback port 11435.");
    let result = axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .map_err(|_| "The companion HTTP service stopped unexpectedly.".to_string());
    sampler.abort();
    result
}
