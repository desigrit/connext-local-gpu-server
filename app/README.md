# Shambu

A small, single-screen companion for checking your Ollama server. Built with Tauri 2, Rust, React, and TypeScript for Windows, macOS, and Android. Shambu is named after Shikari Shambu.

## What it checks

| Check | On the server computer | On a remote device |
| --- | --- | --- |
| Ollama | Local version endpoint and response time | Configured server endpoint and response time |
| Tailscale | Local CLI connection status | The GPU PC's status through its paired host companion |
| Forwarding | Matching TCP forward plus a request through the host's Tailscale IPv4 | The GPU PC's forwarding check through its paired host companion |
| GPU history | Hourly observed activity and GPU name from the host companion | The same history and GPU name through the paired host companion |
| Model library | Installed model names and sizes | Installed model names and sizes |

All probes are read-only. Ollama requests are limited to GET `/api/version`, `/api/tags`, and `/api/ps`. Paired remote clients also read GET `/health` from the host companion. Checks send no prompts and do not load models, download files, or restart the server. The separate app links can open installed Ollama or Tailscale on the device running Shambu.

**Idle is not a failure.** With no loaded model, the app cannot verify Ollama's GPU use. A visible NVIDIA device confirms driver visibility only. A loaded model with zero GPU allocation gets a CPU warning; a partial allocation gets a GPU + CPU warning. GPU memory allocation is not the same as current utilization.

Connection state and age sit directly under the readiness heading, beside the refresh icon. **Just now** means the reading is less than two minutes old; later ages use whole minutes. Checks refresh every five minutes while the app is visible and Settings is closed. The refresh icon starts a check immediately and spins for at least two seconds before presenting the result. Readings become stale at 330 seconds, and a failed refresh also marks retained readings stale. Closing the app stops its checks.

**Connected** is a combined readiness result: Ollama, Tailscale, forwarding, host evidence, and the model library must be verified and current. An idle GPU is healthy. **Connection issue** identifies a Tailscale or forwarding problem, **Needs attention** covers GPU or model warnings, and **Check needed** covers stale or unverified evidence. An unreachable Ollama service shows **Disconnected**. A reachable Ollama endpoint alone does not produce green Connected.

## Use it

On the GPU PC, choose **Settings > This computer** and use `http://127.0.0.1:11434`. Local probes use this loopback address. The main screen shows and copies the Tailscale URL for your other devices once it detects a matching TCP forward. If that address is unavailable, the copy control is disabled.

On another Windows PC, a Mac, or Android, choose **Remote server** and enter your GPU PC's Tailscale URL, such as `http://<gpu-pc-tailscale-ip>:11434`. Keep Tailscale connected on both devices. Missing local apps offer installation actions. Finish Tailscale sign-in in its own app.

To see the GPU PC's own Tailscale and forwarding status remotely, [set up the host companion](../docs/host-agent.md) once. In Shambu on that PC, open **Settings** and copy the visible eight-character code. Enter it under **Pairing code** on the remote device. A code works once and expires after five minutes. The countdown shows its remaining time, and a new code appears automatically at expiry while Settings is visible. Reopening Settings also creates a new code. Without pairing, host-only checks remain unverified.

The single-column dashboard opens at 1300 × 840, fitting smaller displays when needed. Readiness leads the page, with an icon-only **Settings** action at the top right. Settings and **Model library** expand smoothly downward while the header stays in place. Settings has **Cancel** and **Save** at the bottom right, plus a back arrow that also discards edits. Save becomes available when the form has a valid change. Paired devices show **Change** and **Unpair** actions. Small click animations respect the device's reduced-motion preference.

Failed checks show their evidence, recovery advice, and **Check again** directly. Ollama failures also offer **Edit address**. Stale readings offer **Refresh now**; an app-wide check error offers **Try again**. See the [UX state guide](../docs/ux-states.md) for each state and recovery path.

A successful check on the host does not prove access from every peer or from mobile data. Check from the device you intend to use while traveling.

## Open companion apps

Select the Ollama or Tailscale row name to open that app **on this device**. The outward arrow and hover or focus hint identify the action. Ollama uses its bundled mark; Tailscale uses the supplied nine-dot image. Selecting it while checking a remote GPU PC still opens the app on the device running Shambu, not on the remote PC.

Windows and macOS can open installed Ollama and Tailscale. Android offers Tailscale only; Ollama must be opened on the GPU PC. A successful launch request can reveal a tray or menu-bar app instead of a window. Missing or unsupported apps show a useful message. Browser previews cannot launch native apps. See the [native launcher guide](../docs/native-launchers.md) for platform and installation limits.

## GPU history

The **GPU usage** section follows the status rows. The GPU name sits at the right of the heading, with GPU load and VRAM on separate lines beneath it. Readings align to the right with reserved number widths, so their labels stay still. VRAM uses whole numbers, such as **41/48 G**.

The bar shows a rolling **48-hour** window, with one slender vertical bar per hourly bucket. Active hours are forest green, while Idle hours use a pale fill. Straight sides and gently rounded ends keep each bar distinct, with a small visible gap. Partial hours at either end produce 49 bars. **48h**, **24h**, and **Now** labels mark the range.

Hover, tap, or focus a pill to inspect its hour in a custom tooltip, such as **9 AM · Idle**. Times use your device's local zone without displaying an abbreviation. Tab enters the strip at the latest or last inspected hour. Left and right arrows move between hours, Home and End move to the first and last, and Escape closes the tooltip. Empty and unmonitored hours display **Idle**.

The host companion samples NVIDIA GPU utilization every five seconds and correlates activity of at least 5% with fresh evidence that Ollama has a model in GPU memory. This estimates Ollama-related activity; other GPU work can contribute while a model stays loaded, and very short activity may be missed. This is an activity estimate, not a measurement of exact Ollama request counts.

Continuous activity fills every hour in which it is observed. Burst starts are also retained separately, using 60 quiet seconds between bursts, but the chart does not use burst counts as utilization or request counts.

The companion stores 48 hours of activity privately on the GPU PC and keeps collecting when the app window is closed. Pair it to see the same history from another device. History recorded by older all-GPU collectors stays separate and is not relabeled as Ollama activity.

The detected GPU name appears at the right of the GPU usage heading, wrapping below it on narrow screens. CPU and partial GPU allocation warnings remain visible below the status rows when they need attention.

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

That command produces a debug APK. The release workflow builds an unsigned release APK instead. The maintainer downloads it, signs it locally using a stable private project key, verifies the signature, and publishes only the signed APK. No private signing key is uploaded to GitHub. A debug preview must be uninstalled before switching to the release signature.

## Automated builds

The [Build readiness app workflow](../.github/workflows/app.yml) checks the Rust core and interface and builds Windows x64, Windows ARM64, Apple Silicon Mac, and Android arm64 artifacts. The release workflow prepares a draft after checks pass. Android is signed locally before the draft is published. Download installable packages from [Releases](https://github.com/desigrit/shambu/releases/latest).

Build success proves compilation and packaging. It does not replace running the app against your own server on each device.

## Verify without using the GPU

```sh
cargo test -p readiness -p shambu-agent -p shambu
cargo clippy -p readiness -p shambu-agent -p shambu --all-targets -- -D warnings
npm run build
npx playwright install chromium
npm test
```

The Rust tests cover endpoint safety, GPU allocation distinctions, Tailscale evidence, forwarding targets, invalid API responses, redirect rejection, and native app-launch targets. Interface tests exercise labeled synthetic readiness and recovery states, settings, accessibility, and narrow layouts.

For a read-only live host check that prints status labels without addresses or model names:

```sh
cargo run -p readiness --example check
```

`npm run dev` opens a browser development server. Add `?demo=healthy` to enter the clearly labeled **Design preview**. Its selector includes All ready, Ollama offline, Tailscale disconnected, Forwarding missing, Pairing key rejected, Host companion offline, CPU fallback, No models, Stale readings, and Host not linked. The corresponding query values are `healthy`, `offline`, `tailscale`, `forwarding`, `pairing`, `companion`, `cpu`, `empty`, `stale`, and `remote`.

Choose **Simulate recovery** to replace a failure scenario with healthy sample readings. Preview settings are limited to the browser session and do not retain pairing keys. Browser previews cannot inspect local processes or launch native apps. Production builds omit the synthetic selector, and the installed Tauri app uses the Rust backend. See the [UX state guide](../docs/ux-states.md) for the review sequence.

## Privacy and limits

- Your server address, display name, and optional pairing key are saved in the app's private local configuration folder as `connection.json`. The file is not encrypted. The pairing key grants read-only host diagnostics; keep it private.
- No telemetry, accounts, analytics, or diagnostic uploads. Fonts and icons are bundled.
- Status readings stay in memory. The host companion privately saves recent GPU burst timestamps, active hourly buckets, and collector timing state. Tailscale peer lists, logs, and model contents are neither displayed nor saved.
- Server probes have a four-second timeout, a response-size limit, no redirects, and no proxy inheritance. Authenticated reverse proxies and custom certificate authorities are not supported by this first version.
- Desktop subprocesses use fixed arguments and known executable locations. They never run user-entered shell commands.
- Android reads the host's status through the companion. It does not inspect the Android Tailscale app or claim that the phone's VPN is connected.
- Closing the desktop window keeps Shambu in the tray; choose Quit Shambu to stop it. The separately installed host companion remains available for other devices. This is not a reboot guarantee, GPU stress test, or inference benchmark.
- The application reports the configured server's responses. It does not prove the identity of an arbitrary HTTP endpoint.

The app source lives in `src/`, the native window and settings bridge in `src-tauri/`, and the platform-independent Rust probes in `crates/readiness/`. Brand text and artwork references are centralized in `src/brand.ts`.

Artwork sources and platform-icon provenance are recorded in the [branding notes](../docs/branding.md).

The development-only [bar comparison](http://127.0.0.1:1420/?bars=compare) shows six options with identical sample hours. Each can be previewed in the dashboard. Slender is the selected app direction.

## In-app updates

The [update guide](../docs/updates.md) covers the version footer, desktop restart flow, Play Store-managed Android updates, signed release feed, and maintainer publishing steps. Update signing happens locally after CI builds the packages.
