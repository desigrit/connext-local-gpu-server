# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri 2, Rust, React, and TypeScript. The user approved one Rust backend and a shared interface packaged for Windows, macOS, and Android, built directly in code. Native windows and mobile safe areas surround the shared interface.

## Users

People with an Ollama GPU server at home who want to check its readiness from that PC, a laptop, or an Android phone, at home or while traveling.

## Product Purpose

One screen answers whether the server can be reached and which part of the connection needs attention. Compact hourly pills show observed Ollama GPU activity over a rolling 48-hour window. Launch, inspect, recover, close.

## Operating Context

Ollama listens locally on a Windows GPU PC. Tailscale provides private access through a TCP forward. Client devices connect through a configured endpoint. The repository documents setup and unattended recovery.

## Capabilities and Constraints

The Windows backend must use Rust. Support Windows, macOS, and Android. Use read-only probes that never load a model. Local CLI diagnostics are available only on supported desktop hosts. Remote checks read authenticated host diagnostics through a small companion service, separate from direct Ollama connectivity. Missing host evidence stays explicitly unverified. Keep endpoint settings on the device and private data out of the public repository.

Ollama and Tailscale row links open the installed app on the device running Shambu. They never open a window on the remote GPU PC. Android offers the Tailscale link only. Report launch results with a useful next step; see the [native launcher guide](docs/native-launchers.md).

## Brand Commitments

A quiet, light, minimal interface with clear status rows and a little whimsy. No em dashes. The name is Shambu, inspired by Shikari Shambu. Use the active R2-D2 artwork and original forest in the native icon. The main viewport starts with readiness and contains no repeated product label or mascot. Preserve the artwork and source credits in the [branding notes](docs/branding.md).

Desktop defaults to a centered 1120 by 760 window, fitted to the available display. Preserve the operating-system title bar and controls. Center the single-column dashboard when it fits, with balanced margins and normal scrolling for longer content. Settings is an icon-only action at the top right. Its panel explains which server this device checks and ends with right-aligned Cancel and Save actions.

Place combined connection status, a hyphen, relative check age, and the Fluent refresh icon directly under the readiness heading. Green Connected requires fresh, verified Ollama, Tailscale, forwarding, host details, and model readiness. An idle GPU is healthy. Connection failures, missing evidence, and GPU or model warnings keep the combined status out of green even when Ollama responds. Use Disconnected, Connection issue, Needs attention, or Check needed as appropriate.

Show Just now for readings younger than two minutes, then whole minutes. Refresh automatically every five minutes while visible and outside Settings. Readings become stale after 330 seconds; show a clear recovery action.

Four aligned rows use colored state dots beside their words. Ollama uses its bundled mark; Tailscale uses the user's supplied nine-dot PNG with original pixels preserved and its white background blended into the page. Their links open local apps. Only the installed model library expands; its real model names and sizes include the Qwen mark when appropriate. Keep failure guidance visible with Check again, Edit address, and relevant app-launch actions. Private host pairing remains in Settings.

The main server strip shows the Tailscale URL other devices use. GPU usage follows the readings with a GPU icon and Remote GPU device label. The selected Slender direction uses 49 thin vertical bars, one per hourly bucket, with straight sides, rounded ends, and visible gaps. Active hours fill forest green; Idle hours have a pale fill. 48h, 24h, and Now labels mark the rolling window. Activity is an estimate, not an inference request count. Empty and unmonitored hours stay Idle.

Browser development previews provide a clearly labeled synthetic-state selector and simulated recovery. Production builds omit the selector. The [UX state guide](docs/ux-states.md) covers healthy, failure, unverified, stale, and recovery paths.

## Product Principles

- Report evidence, including uncertainty.
- Make the broken link and next action easy to find.
- Keep diagnostics read-only and lightweight.
- Keep configuration private and local.
