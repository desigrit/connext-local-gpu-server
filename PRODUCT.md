# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri 2, Rust, React, and TypeScript. The user approved one Rust backend and a shared interface packaged for Windows, macOS, and Android, built directly in code. Native windows and mobile safe areas surround the shared interface.

## Users

People with an Ollama GPU server at home who want to check its readiness from that PC, a laptop, or an Android phone, at home or while traveling.

## Product Purpose

One screen answers whether the server can be reached and which part of the connection needs attention. A slim strip of hourly columns shows observed Ollama GPU activity over a rolling 24-hour window. Launch, inspect, close.

## Operating Context

Ollama listens locally on a Windows GPU PC. Tailscale provides private access through a TCP forward. Client devices connect through a configured endpoint. The existing repository documents setup and unattended recovery.

## Capabilities and Constraints

The Windows backend must use Rust. Support Windows, macOS, and Android. Use read-only probes that never load a model. Local CLI diagnostics are available only on supported desktop hosts. Remote checks read authenticated host diagnostics through a small companion service, separate from direct Ollama connectivity. Missing host evidence stays explicitly unverified. Keep endpoint settings on the device and private data out of the public repository.

## Brand Commitments

A quiet, light, minimal interface with clear status rows and a little whimsy. No em dashes. The name is Shambu, inspired by Shikari Shambu. The current icon direction is a distinctive flat R2-D2, angled toward the right and small enough to fit within the original Shambu forest circle. Reuse the existing forest and foreground bushes rather than redrawing them. It must remain legible at taskbar sizes. Source artwork and modifications are credited. Branding belongs in the native title bar and app icon, without a duplicate wordmark or portrait in the dashboard.

Desktop opens in a standard landscape window similar to Ollama. The dashboard uses one column on all devices. A long, narrow GPU activity strip stays visible below Model Library, with rolling 24-hour columns. A filled hour means observed GPU activity correlated with an Ollama model loaded in GPU memory; this is an estimate, not an inference request count. Empty and unmonitored hours display Idle. Only the GPU name sits above the strip. Custom hour tooltips show local time, time zone, and Active or Idle. There are no range controls, axes, legend, or information bubble. The main server strip shows the Tailscale URL other devices use.

Use Active consistently in status rows. Refresh automatically every two minutes. The footer combines a green Connected indicator, relative check time, and an icon-only Fluent refresh control. Keep actionable failure details visible. Only the installed model library and necessary configuration need disclosures.

## Product Principles

- Report evidence, including uncertainty.
- Make the broken link easy to find.
- Keep diagnostics read-only and lightweight.
- Keep configuration private and local.