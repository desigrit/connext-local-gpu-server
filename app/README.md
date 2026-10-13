# Shambu

A small, single-screen companion for checking your Ollama server. Built with Tauri 2, Rust, React, and TypeScript for Windows, macOS, and Android. Shambu is named after Shikari Shambu. Its R2-D2 taskbar artwork is credited in the [branding notes](../docs/branding.md).

## What it checks

| Check | On the server computer | On a remote device |
| --- | --- | --- |
| Ollama | Local version endpoint and response time | Configured server endpoint and response time |
| Tailscale | Local CLI connection status | The GPU PC's status through its paired host companion |
| Forwarding | Matching TCP forward plus a request through the host's Tailscale IPv4 | The GPU PC's forwarding check through its paired host companion |
| GPU Usage | Hourly observed activity and GPU name from the host companion | The same history and GPU name through the paired host companion |
| Model library | Installed model names and sizes | Installed model names and sizes |

All probes are read-only. Ollama requests are limited to GET `/api/version`, `/api/tags`, and `/api/ps`. Paired remote clients also read GET `/health` from the host companion. There are no prompts, model loads, downloads, restart buttons, or changes to your server.

**Idle is not a failure.** With no loaded model, the app cannot verify Ollama's GPU use. A visible NVIDIA device confirms driver visibility only. A loaded model with zero GPU allocation gets a CPU warning; a partial allocation gets a GPU + CPU warning. GPU memory allocation is not the same as current utilization.

Checks refresh every two minutes while the app is visible and connection settings are closed. The refresh icon runs an immediate check. Readings older than 150 seconds become stale. Closing the app stops its checks.

## Use it

On the GPU PC, choose **Connection > This computer** and use `http://127.0.0.1:11434`. Local probes use this loopback address. The main screen shows and copies the Tailscale URL for your other devices once it detects a matching TCP forward. If that address is unavailable, the copy control is disabled.

On another Windows PC, a Mac, or Android, choose **Remote server** and enter your GPU PC's Tailscale URL, such as `http://<gpu-pc-tailscale-ip>:11434`. Keep Tailscale connected on both devices. The app does not install or sign in to Tailscale.

To see the GPU PC's own Tailscale and forwarding status remotely, [set up the host companion](../docs/host-agent.md) once. In Shambu on that PC, open **Connection > Copy pairing key**. Paste the key into **Connection > Host pairing key** on each remote device. Without pairing, Ollama and GPU allocation checks still work; host-only checks remain explicitly unverified.

Expand **Model library** to see the installed models and their sizes. Failed checks show their evidence and recovery advice directly. A successful check on the host does not prove access from every peer or from mobile data. Check from the device you intend to use while traveling.

## GPU Usage

A slim activity strip sits directly below Model Library in the single-column layout. It shows a rolling **24-hour** window, with one column per hourly bucket. A filled column means activity was observed in that hour. The window includes partial hours at either end, so it displays 25 columns. Hover, tap, or use the arrow keys to inspect an hour in a custom tooltip, such as **9am PDT: Idle**. Times use your device's time zone. Empty and unmonitored hours display **Idle**.

The host companion samples NVIDIA GPU utilization every five seconds and correlates activity of at least 5% with fresh evidence that Ollama has a model in GPU memory. This estimates Ollama-related activity; other GPU work can contribute while a model stays loaded, and very short activity may be missed. This is an activity estimate, not a measurement of exact Ollama request counts.

Continuous activity fills every hour in which it is observed. Burst starts are also retained separately, using 60 quiet seconds between bursts, but the chart does not use burst counts as utilization or request counts.

The companion stores 48 hours of activity privately on the GPU PC and keeps collecting when the app window is closed. Pair it to see the same history from another device. History recorded by older all-GPU collectors stays separate and is not relabeled as Ollama activity.

The detected GPU name appears above the activity strip. CPU and partial GPU allocation warnings remain visible below the status rows when they need attention.

## Build and run

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), Rust stable, and Node.js 22.12 or newer. Windows builds require the MSVC C++ tools and WebView2. Mac builds require Xcode command-line tools.

From this folder:

```sh
npm ci
npm run tauri dev
```

Create a Windows installer on Windows:

```sh
npm run tauri -- build --bundles nsis
```

Create a Mac app and disk image on macOS:

```sh
npm run tauri -- build --bundles app,dmg
```

Without developer signing credentials, these are development distributions. Windows may show a publisher warning. Mac builds use ad-hoc signing in CI and are not notarized. Use your normal developer signing and notarization process before distributing a release to other people. [Tauri signing documentation](https://v2.tauri.app/distribute/sign/windows/).

### Android

Install Android Studio, a JDK supported by its Gradle version, Android SDK platform/build tools, and the Android NDK. Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME` for your machine. Follow the [Tauri Android prerequisites](https://v2.tauri.app/start/prerequisites/#android).

```sh
rustup target add aarch64-linux-android
npm run tauri -- android init --ci --skip-targets-install
npm run android:prepare
npm run tauri -- android build --debug --apk --target aarch64
```

The preparation step copies the exported launcher icons, enables the HTTP endpoints commonly used inside Tailscale, and disables Android cloud backup for the connection settings. Generated Android files stay out of Git; rerun preparation after regenerating the project.

The resulting arm64 APK is a development preview for a physical Android phone. Debug builds use a development signing key. CI runs generate their own debug keys, so installing an APK from a later CI run may require uninstalling the earlier preview first, which removes saved settings. A stable production signing key is deliberately not included.

## Automated builds

The [Build readiness app workflow](../.github/workflows/app.yml) checks the Rust core and interface and builds Windows x64, Apple Silicon Mac, Intel Mac, and Android arm64 artifacts. Download packages from a successful run in the repository's Actions tab.

Build success proves compilation and packaging. It does not replace running the app against your own server on each device.

## Verify without using the GPU

```sh
cargo test -p readiness -p shambu-agent
cargo clippy -p readiness -p shambu-agent --all-targets -- -D warnings
npm run build
npx playwright install chromium
npm test
```

The Rust tests cover endpoint safety, GPU allocation distinctions, Tailscale evidence, forwarding targets, invalid API responses, and redirect rejection. Interface tests cover healthy, unreachable, CPU, remote, stale, settings, accessibility, and narrow layouts using labeled synthetic data.

For a read-only live host check that prints status labels without addresses or model names:

```sh
cargo run -p readiness --example check
```

`npm run dev` opens a browser development server. Its `?demo=healthy`, `?demo=offline`, `?demo=cpu`, and `?demo=remote` previews use sample data, clearly labeled. A browser preview cannot inspect local processes. The installed Tauri app always uses the Rust backend.

## Privacy and limits

- Your server address, display name, and optional pairing key are saved in the app's private local configuration folder as `connection.json`. The file is not encrypted. The pairing key grants read-only host diagnostics; keep it private.
- No telemetry, accounts, analytics, or diagnostic uploads. Fonts and icons are bundled.
- Status readings stay in memory. The host companion privately saves recent GPU burst timestamps, active hourly buckets, and collector timing state. Tailscale peer lists, logs, and model contents are neither displayed nor saved.
- Requests have a four-second timeout, a response-size limit, no redirects, and no proxy inheritance. Authenticated reverse proxies and custom certificate authorities are not supported by this first version.
- Desktop subprocesses use fixed arguments and known executable locations. They never run user-entered shell commands.
- Android reads the host's status through the companion. It does not inspect the Android Tailscale app or claim that the phone's VPN is connected.
- Closing the app stops its polling. The separately installed host companion remains available for other devices. This is not a reboot guarantee, GPU stress test, or inference benchmark.
- The application reports the configured server's responses. It does not prove the identity of an arbitrary HTTP endpoint.

The app source lives in `src/`, the native window and settings bridge in `src-tauri/`, and the platform-independent Rust probes in `crates/readiness/`. Brand text and artwork references are centralized in `src/brand.ts`.

Artwork sources and platform-icon provenance are recorded in the [branding notes](../docs/branding.md).
