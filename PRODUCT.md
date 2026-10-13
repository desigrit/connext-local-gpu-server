# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri 2, Rust, React, and TypeScript. The user approved one Rust backend and a shared interface packaged for Windows, macOS, and Android, built directly in code. Native windows and mobile safe areas surround the shared interface.

## Users

People with an Ollama GPU server at home who want to check its readiness from that PC, a laptop, or an Android phone, at home or while traveling.

## Product Purpose

One screen answers whether the server can be reached and which part of the connection needs attention. An hourly firefly chart shows recorded GPU activity bursts over the last 24 hours. Launch, inspect, close.

## Operating Context

Ollama listens locally on a Windows GPU PC. Tailscale provides private access through a TCP forward. Client devices connect through a configured endpoint. The existing repository documents setup and unattended recovery.

## Capabilities and Constraints

The Windows backend must use Rust. Support Windows, macOS, and Android. Use read-only probes that never load a model. Local CLI diagnostics are available only on supported desktop hosts. Remote checks read authenticated host diagnostics through a small companion service, separate from direct Ollama connectivity. Missing host evidence stays explicitly unverified. Keep endpoint settings on the device and private data out of the public repository.

## Brand Commitments

A quiet, light, minimal interface with clear status rows and a little whimsy. No em dashes. The name is Shambu, inspired by Shikari Shambu. Its character illustration has a broad toothy grin, green clothes, and comically oversized binoculars extending beyond a circular Indian jungle scene. Most of the smaller figure is hidden by foliage. The derivative preserves the character identity and supplied visual reference; its source and image edits are credited.

Desktop opens in a standard landscape window similar to Ollama. Phones retain a compact vertical layout. GPU usage is visualized as fireflies grouped by hour. One usage instance means an observed GPU activity burst, not an Ollama request. Empty and unmonitored hours display Idle.

## Product Principles

- Report evidence, including uncertainty.
- Make the broken link easy to find.
- Keep diagnostics read-only and lightweight.
- Keep configuration private and local.