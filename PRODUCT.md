# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri 2, Rust, React, and TypeScript. The user approved one Rust backend and a shared interface packaged for Windows, macOS, and Android, built directly in code. Native windows and mobile safe areas surround the shared interface.

## Users

People with an Ollama GPU server at home who want to check its readiness from that PC, a laptop, or an Android phone, at home or while traveling.

## Product Purpose

One screen answers whether the server can be reached and which part of the connection needs attention. Compact hourly dots show observed Ollama GPU activity over a rolling 24-hour window. Launch, inspect, recover, close.

## Operating Context

Ollama listens locally on a Windows GPU PC. Tailscale provides private access through a TCP forward. Client devices connect through a configured endpoint. The repository documents setup and unattended recovery.

## Capabilities and Constraints

The Windows backend must use Rust. Support Windows, macOS, and Android. Use read-only probes that never load a model. Local CLI diagnostics are available only on supported desktop hosts. Remote checks read authenticated host diagnostics through a small companion service, separate from direct Ollama connectivity. Missing host evidence stays explicitly unverified. Keep endpoint settings on the device and private data out of the public repository.

Ollama and Tailscale row links open the installed app on the device running Shambu. They never open a window on the remote GPU PC. Android offers the Tailscale link only. Report launch results with a useful next step; see the [native launcher guide](docs/native-launchers.md).

## Brand Commitments

A quiet, light, minimal interface with clear status rows and a little whimsy. No em dashes. The name is Shambu, inspired by Shikari Shambu. The native icon places a larger R2-D2 in front of the original forest artwork. Preserve the existing forest and foreground bushes rather than redrawing them. Keep the icon legible at taskbar sizes and credit its source artwork and modifications. The dashboard begins with readiness, without a repeated wordmark or portrait. Current assets are recorded in the [branding notes](docs/branding.md).

Desktop defaults to a centered 1120 by 760 window, adjusted to fit the available display. The supported title bar and page share the same light background. Center the single-column dashboard horizontally and vertically when it fits, with balanced margins and normal scrolling for longer content. Settings remains visibly labeled.

Place connection state, a hyphen, relative check age, and the Fluent refresh icon directly under the heading. Show Just now for readings younger than two minutes, then whole minutes. Refresh automatically every five minutes while visible and outside Settings. Readings become stale after 330 seconds; show a clear recovery action.

Four aligned rows use colored state dots beside their words. Healthy service checks use Active. Ollama and Tailscale use their official marks and local app links. Only the installed model library expands; its real model names and sizes include the Qwen mark when appropriate. Keep failure guidance visible with Check again, Edit address, and relevant app-launch actions. Private host pairing remains in Settings.

The main server strip shows the Tailscale URL other devices use. Below the readings, show only the GPU name and a narrow line of 25 hourly dots spanning the rolling 24-hour window, including partial hours at both ends. A filled dot means observed GPU activity correlated with an Ollama model loaded in GPU memory. This is an estimate, not an inference request count. Empty and unmonitored hours display Idle. Hover, touch, and keyboard inspection show local time and state, such as 9 AM · Idle, with the device time zone implicit.

Browser development previews provide a clearly labeled synthetic-state selector and simulated recovery. Production builds omit the selector. The [UX state guide](docs/ux-states.md) covers healthy, failure, unverified, stale, and recovery paths.

## Product Principles

- Report evidence, including uncertainty.
- Make the broken link and next action easy to find.
- Keep diagnostics read-only and lightweight.
- Keep configuration private and local.
