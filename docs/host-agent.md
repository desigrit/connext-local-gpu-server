# Host details on every device

Shambu checks Ollama directly from the device you are holding. To read the GPU PC's own Tailscale connection, forwarding configuration, idle GPU driver visibility, and 48-hour inference activity estimate, run the small **Shambu host companion** on that PC.

The companion is a separate Rust process. Closing the Shambu window does not stop it. It never loads a model, restarts Ollama, runs inference, or changes networking. It polls read-only Ollama endpoints and fixed local Tailscale and NVIDIA commands.

## Two paths, one page

~~~text
Mac / Android / another Windows PC
  Shambu
    |
    | Tailscale, Ollama port 11434
    +--> Ollama: API reachability, models, loaded GPU allocation
    |
    | Tailscale, companion port 11435 + pairing key
    +--> Shambu host companion: the GPU PC's Tailscale, forwarding, GPU name, and inference history
~~~

This distinction matters. A green Tailscale indicator on your phone does not prove the GPU PC is connected. The remote Shambu app displays **Tailscale on server** only from an authenticated, fresh companion response. Without a linked companion, that row reads **Not linked** and Ollama checks still work.

If the PC is offline, the app can report that it cannot reach the services. It cannot distinguish a power outage from a disconnected network without an independent device observing the PC.

## Download the companion on Windows

Download the companion for [Windows x64](https://github.com/desigrit/shambu/releases/download/v0.2.0/Shambu-Host-Windows-x64.zip) or [Windows ARM64](https://github.com/desigrit/shambu/releases/download/v0.2.0/Shambu-Host-Windows-ARM64.zip). Extract it, open Windows PowerShell as Administrator in that folder, and run:

~~~powershell
.\Install-ShambuAgent.ps1 -AgentExe .\shambu-agent.exe
~~~

If the companion is already installed, uninstall its managed task first using the included Uninstall-ShambuAgent.ps1, then install the new executable. The private configuration, credential, and history are preserved. Ollama is not restarted. Keep the existing Tailscale forwards.

## Build the companion on Windows

From the repository's app directory:

~~~powershell
cargo build --release --locked -p shambu-agent
~~~

The executable is app/target/release/shambu-agent.exe. It shares the app's Rust readiness library.

## Start once before installing startup

In a PowerShell window opened directly from the Start menu under the account that runs Shambu:

~~~powershell
.\app\target\release\shambu-agent.exe --init
.\app\target\release\shambu-agent.exe
~~~

Initialization creates a random 256-bit pairing key in the current account's private app-data directory. It does not print the key. An existing key is never overwritten.

The default Ollama endpoint is http://127.0.0.1:11434. If Ollama uses another local port, initialize with:

~~~powershell
.\app\target\release\shambu-agent.exe --init --ollama-url http://127.0.0.1:12345
~~~

The companion's listener is fixed to **127.0.0.1:11435**. It cannot bind a LAN or public interface. Its first check may take several seconds. Until a fresh result is available, its authenticated health endpoint returns HTTP 503.

Use Ctrl+C to stop a foreground companion before installing its startup task.

## Keep it available after a reboot

Open Windows PowerShell directly from the Start menu as Administrator using the same Windows account. Avoid running installation inside a packaged app or its embedded terminal: Windows can redirect new app-data files into a package container that background tasks cannot see. The installer checks for redirection with an empty temporary directory before creating configuration or tasks. [Microsoft virtualization reference](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization). From the repository root:

~~~powershell
.\scripts\Install-ShambuAgent.ps1
~~~

The installer:

- Initializes private configuration if it does not exist.
- Copies the companion into the account's private app-data directory.
- Registers the Shambu-Agent scheduled task with S4U logon and limited privileges.
- Starts after boot with a one-minute delay, even before sign-in.
- Triggers every minute for recovery; IgnoreNew prevents duplicate instances.
- Waits for an authenticated fresh response, without asking Ollama to run a model.

S4U does not save your Windows password and cannot access encrypted files or authenticated network shares. The task uses local files and checks services on this PC. [Microsoft S4U reference](https://learn.microsoft.com/en-us/windows/win32/taskschd/principal-logontype). It does not change the separate Ollama task, Tailscale, sleep settings, drivers, or updates. Keep the PC awake and Tailscale in unattended mode as described in the [server setup](server-setup.md).

When updating the companion, uninstall its managed task, rebuild, then install again. Its pairing key is preserved. The installation check confirms the task starts in its configured account. Test a full reboot separately before relying on it while traveling.

## Add one private Tailscale forward

On the GPU PC:

~~~powershell
tailscale serve --bg --tcp=11435 tcp://127.0.0.1:11435
~~~

Keep the existing Ollama port 11434 forward. This additional Serve port remains inside your tailnet. Background Serve configuration persists across restarts. [Tailscale Serve reference](https://tailscale.com/docs/reference/tailscale-cli/serve). Do not enable Funnel or router port forwarding. If your tailnet uses restrictive policies, allow your client devices to reach the GPU PC on both ports.

Check the persistent configuration:

~~~powershell
tailscale serve status
~~~

The setup uses Tailscale to encrypt network traffic. The local HTTP listener is protected by a bearer pairing key. Use the companion through Tailscale or a trusted HTTPS proxy, since plain HTTP on an unencrypted network would expose that key.

## Link a remote Shambu app

1. Open Shambu on the GPU PC. In Settings, copy the visible eight-character pairing code.
2. Open Shambu on the Mac, Android device, or other Windows PC.
3. Choose Remote server and enter the GPU PC's Tailscale Ollama base URL.
4. Enter that code in the Pairing code field and save. A code works once and expires after five minutes; use New code to pair another device.

Use your own Tailscale address, not localhost. The companion URL is derived from that same address on port 11435. An optional custom URL can use another port or HTTP/HTTPS scheme, but must use the same hostname or IP. Redirects are refused, so a server cannot redirect the credential elsewhere.

The short code exchanges for a strong credential that Shambu saves privately. The code has five attempts before it must be replaced on the GPU PC. Pair only devices you trust. Shambu stores connection settings on each device and does not upload them to GitHub or a cloud service. Clipboard history and cross-device clipboard sync may retain copied secrets; clear the clipboard after pairing if needed.

## What the companion proves

| Row | Evidence |
| --- | --- |
| Ollama server | The client directly gets a valid Ollama version response. |
| Tailscale on server | The host CLI reports Running and explicitly confirms Self.Online. |
| Server forwarding | The host has a matching TCP forward and its Ollama version check through its own Tailscale address succeeds. |
| Inference activity estimate | The host correlates NVIDIA GPU utilization with fresh Ollama GPU allocation evidence and records estimated activity burst starts. Loaded model memory still supplies GPU allocation warnings. |
| Model library | The client directly reads installed model names and sizes from Ollama without loading a model. |

A host's forwarding check does not prove every peer is allowed through a tailnet policy. The client-to-Ollama check provides separate evidence for the device you are using.

An idle GPU is reported as idle. A visible driver alone does not prove a future model will run on the GPU. Loaded models with zero GPU allocation or partial offload receive a warning.

## Estimated inference activity during the last 48 hours

The GPU usage section shows a rolling 48-hour window as 49 slender hourly bars, including partial hours at both ends. A filled pill marks an hour with observed estimated Ollama GPU activity. Every qualifying sample marks its UTC hour, so continuous activity fills every hour it crosses. A fixed read-only NVIDIA utilization query runs every five seconds, independently of the readiness checks. A sample counts as active only when at least one GPU has 5% utilization and a cached Ollama running-model response shows a model allocated to GPU memory. That model evidence must be no more than 15 seconds old. A model merely staying loaded does not create activity.

Activity begins a new burst on the first observed active sample, or when at least 60 seconds have elapsed since the previous qualifying active sample. Brief quiet gaps stay in the same burst, including bursts that cross an hour boundary. Burst-start timestamps are retained separately for counts; the hourly pills use all hours with qualifying samples.

This is an inference estimate, not a count of Ollama requests. Other GPU work can contribute while an Ollama model remains loaded in GPU memory, and short activity between samples can be missed. No model is loaded and no inference request is made to populate the chart. The existing loaded-model evidence still warns when Ollama reports CPU use or partial GPU allocation.

Hours without observed qualifying activity display Idle. This includes time before collection started or while the companion, PC, model evidence, or GPU query was unavailable. Missing time is never backfilled.

Burst timestamps survive companion restarts. The last 48 hours of burst starts are retained, with a hard limit of 3,000 starts. Activity hours also retain the oldest partial hour, bounded to 49 unique UTC hour-start timestamps. The companion stores these timestamps, the last qualifying active sample time, the most recent successful utilization sample time, and a file-format version. It stores no utilization payloads, process names, model names, or model sizes in history. A missing, oversized, unsupported, or corrupt history file safely starts an empty history and preserves the pairing key. A system clock rollback clears inconsistent future history before collection resumes.

Inference estimates are stored separately in ollama-activity.json. An older history.json file containing all-GPU activity is preserved and never imported into the inference estimate. The authenticated response marks the new history with source set to ollama-gpu-estimate; clients ignore unmarked or differently marked history while retaining compatible host checks.

The host app displays and copies the advertised Tailscale address and matching Serve TCP port when that configuration is available. Its readiness probes continue to use the configured loopback endpoint. GPU names come from the host's driver query. Installed model names and sizes come directly from the Ollama API on the device performing the check.

## Protocol and storage

Host readings use authenticated **GET /health**. Authenticated **POST /pairing/new** creates a short-lived code; **POST /pairing** redeems it once for the existing strong credential. Responses are never cached. Browser Origin headers are refused, pairing bodies are limited to 512 bytes, and five failed code attempts lock that code until it is replaced. There is no shell, control endpoint, model invocation endpoint, or browser CORS permission.

The bearer credential uses 32 bytes from the operating system's secure random source, encoded as 64 lowercase hexadecimal characters. Equal-length credential comparisons use constant-time comparison. The agent prints only generic lifecycle messages, never the credential, probe payload, or local identity.

Host checks are cached in memory. One polling loop refreshes them about every five seconds. Slow commands can extend this interval. A 15-second outer timeout bounds a probe cycle. Agent samples older than 60 seconds are not served; clients reject an envelope older than 65 seconds including request time. Clients also reject a wrong protocol version, a non-host snapshot, missing checks, and duplicate checks.

The JSON envelope has protocolVersion, sampleAgeMs, and snapshot fields. Snapshot check IDs are ollama, tailscale, forwarding, gpu, and models. The optional gpuHistory field contains source, sampledAtMs, a bursts array of UNIX millisecond timestamps, and activeHours containing UTC hour-start timestamps. Hourly pills use activeHours so a continuous burst can fill multiple hours. The supported source is ollama-gpu-estimate. Older companions without marked inference history remain supported for host checks. Optional externalEndpoint and gpuName fields provide host display information, and installedModels contains name and size entries from the direct Ollama model-list response. A paired remote app uses the authenticated host history; a local desktop app reads it from the fixed loopback companion with the private local pairing key. Client hostDetails states are local, linked, not-linked, unreachable, and unauthorized.

Private configuration locations:

- Windows: %LOCALAPPDATA%\Shambu\agent\config.json
- macOS: ~/Library/Application Support/Shambu/agent/config.json
- Linux: $XDG_CONFIG_HOME/Shambu/agent/config.json, or ~/.config/Shambu/agent/config.json

Windows initialization gives only the current user and SYSTEM inherited access to the agent directory. Unix initialization uses directory mode 0700 and file mode 0600. The companion configuration contains protocolVersion, endpoint, and pairingKey. A separate ollama-activity.json file in the same private directory stores bounded inference-estimate timestamps using atomic replacement. Legacy history.json data is preserved separately. Its read limit is 64 KiB. Other probe results remain in memory.

Keep this configuration out of the repository, screenshots, support reports, and logs.

## Remove the companion

In an elevated PowerShell window under the same account:

~~~powershell
.\scripts\Uninstall-ShambuAgent.ps1
tailscale serve --bg --tcp=11435 off
~~~

The uninstall script verifies the exact managed executable, arguments, working directory, and owning account before disabling and stopping the task. It preserves the pairing key and binary. It does not stop Ollama. Removing only port 11435 preserves the Ollama forward on port 11434.

To revoke paired clients, stop the managed companion, remove its private config.json file, run initialization again, and reinstall startup. The new key must be entered on each trusted client. Do not delete the whole Shambu app-data directory.

## Verification

The Rust tests use synthetic HTTP responses and temporary private configurations. They cover rejected credentials, read-only routing, cache expiration, incomplete and stale host evidence, same-host credential routing, and initialization that preserves an existing key. History tests cover utilization parsing, fresh GPU allocation gating, quiet-period boundaries, continuous activity spanning an hour, oldest-partial-hour coverage, unavailable samples, 48-hour retention, clock changes, restart continuity, bounded storage, corrupt-file recovery, legacy-history isolation, and optional-field compatibility. They do not load models.

~~~powershell
Set-Location app
cargo test --locked -p readiness -p shambu-agent
cargo clippy --locked -p readiness -p shambu-agent --all-targets -- -D warnings
~~~

The companion installer verifies a real authenticated loopback response when you run it. End-to-end access from a second device, platform packaging, and reboot recovery should be checked on the devices where you install the app.
