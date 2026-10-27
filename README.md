<img src="app/src/assets/shambu-icon.png" alt="Shambu" width="72" height="72">

# Shambu

Your GPU is at home. You are somewhere else. Shambu checks that the two of you are still on speaking terms.

One small window shows whether Ollama, Tailscale, and the private connection are working, which models are available, and how the GPU is doing: live load, memory usage, and 48 hours of activity.

![Shambu showing server status, live GPU readings, and 48 hours of activity](docs/previews/app.png)

## Decisions behind Shambu

**Keep the job small.** I wanted to know whether my home GPU was ready to use from another device. Shambu checks the connection, available models and GPU activity without loading a model just to test it. That keeps checks lightweight, but a green status does not prove a model will answer well or quickly.

**Use a private connection, with some setup cost.** The app uses Tailscale and a paired host companion for detailed server readings. This avoids exposing the server directly to the public internet, but each device needs setup. Reaching Ollama and being paired for diagnostics are separate checks. [Connection and privacy details](docs/privacy.md)

**How I worked with AI.** I used Codex to build and refine the app across desktop and phone. I checked the results on my own devices and asked for changes based on what I could actually understand, from connection status to GPU readings that moved around as the numbers changed.

**Where I pushed back.** My phone could reach Ollama, yet showed Tailscale as "Not linked." I questioned that: reaching the server through its Tailscale address was evidence that the route worked. The missing piece was permission to read the host's diagnostics. That exposed a wording problem in the current release; it is not evidence that the connection failed.

**What I would test next.** Can someone distinguish a broken connection, missing diagnostics and old readings, then choose the right next step? I would test those situations on each platform. The app's checks can verify software behavior, but they cannot establish that its status is clear to a person.

## Get the app

| Your device | Download |
| --- | --- |
| Mac with Apple Silicon | [Mac app](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Mac-Apple-Silicon.dmg) |
| Windows with Intel or AMD | [Windows x64](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Windows-x64-Setup.exe) |
| Windows with Snapdragon or another ARM processor | [Windows ARM64](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Windows-ARM64-Setup.exe) |
| Android phone | [Android APK](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Android-arm64.apk) |

[Installation help](docs/install.md)

## Bring your GPU along, figuratively

1. **On the GPU PC:** install Ollama and Tailscale, then follow the [one-time server setup](docs/server-setup.md). Add the [Shambu host companion](docs/host-agent.md) for GPU readings and the PC’s connection checks.
2. **On your other device:** install Tailscale, sign in with the same account, and open Shambu.
3. **In Settings:** choose **Remote server**, paste the GPU PC’s Tailscale Ollama URL, and enter the eight-character code shown in Shambu’s Settings on that PC. Save. Done.

## Why Shambu?

Named after Shikari Shambu, one of the comic-book characters I grew up with. This one also keeps an eye on things, preferably without leaving his chair.

There’s an easter egg. Try **Ctrl + Shift + K** on a PC or Mac.

[Releases](https://github.com/desigrit/shambu/releases) · [Troubleshooting](docs/operations.md) · [Build from source](app/README.md) · [Privacy](docs/privacy.md)

On Windows and Mac, future updates appear beside the version number in the app.
