# Shambu

Your GPU is at home. You are somewhere else. Shambu checks that the two of you are still on speaking terms.

One small window shows whether Ollama, Tailscale, and the private connection are working, which models are available, and when the GPU was busy over the last 48 hours. Checks run every five minutes without loading a model.

![Shambu showing a healthy server and 48 hours of GPU activity](docs/previews/app.png)

*Sample readings. Your addresses and pairing credentials stay on your devices.*

## Get the app

| Your device | Download |
| --- | --- |
| Mac with Apple Silicon | [Mac app](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Mac-Apple-Silicon.dmg) |
| Windows with Intel or AMD | [Windows x64](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Windows-x64-Setup.exe) |
| Windows with Snapdragon or another ARM processor | [Windows ARM64](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Windows-ARM64-Setup.exe) |
| Android phone | [Android APK](https://github.com/desigrit/shambu/releases/latest/download/Shambu-Android-arm64.apk) |

These are early builds. Mac and Windows may ask you to approve the app. See [installation help](docs/install.md).

## Bring your GPU along, figuratively

1. **On the GPU PC:** install Ollama and Tailscale, then follow the [one-time server setup](docs/server-setup.md). Add the [Shambu host companion](docs/host-agent.md) for GPU history and the PC’s connection checks.
2. **On your other device:** install Tailscale, sign in with the same account, and open Shambu.
3. **In Settings:** choose **Remote server**, paste the GPU PC’s Tailscale Ollama URL, and enter the eight-character code shown in Shambu’s Settings on that PC. Save. Done.

A pairing code works once and expires after five minutes. You only pair each device once. Your GPU PC needs to stay on and awake.

Green means the checks are healthy. Amber or red shows what needs attention and what to try next. Hover over a row name for a short explanation. “Forwarding” is simply the private route from your other devices to Ollama.

Shambu is the lookout. Apps such as [Zebby](https://github.com/desigrit/zebby-the-scout) do the actual AI work using the same server URL.

## Why Shambu?

Named after Shikari Shambu, one of the comic-book characters I grew up with. This one also keeps an eye on things, preferably without leaving his chair.

[Releases](https://github.com/desigrit/shambu/releases) · [Troubleshooting](docs/operations.md) · [Build from source](app/README.md) · [Privacy](docs/privacy.md)

