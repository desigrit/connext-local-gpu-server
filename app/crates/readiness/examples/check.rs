// Prints only status labels. Does not print addresses, machine names, or model names.
#[tokio::main]
async fn main() {
    let settings = readiness::Settings::default();
    match readiness::inspect(settings).await {
        Ok(snapshot) => {
            for check in snapshot.checks {
                println!("{}: {} ({:?})", check.title, check.label, check.state);
            }
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
