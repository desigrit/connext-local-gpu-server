# Install Shambu

Download your version from [GitHub Releases](https://github.com/desigrit/shambu/releases/latest). Tailscale is needed on both the GPU PC and the device you carry.

## Windows

Choose **x64** for Intel or AMD PCs, or **ARM64** for Snapdragon and other ARM PCs. Open the setup file.

The early Windows builds do not have a publisher certificate. Windows may show SmartScreen. If you trust this repository and the downloaded file, choose **More info**, then **Run anyway**. Your organization may block unsigned apps.

## Mac with Apple Silicon

Open the DMG and drag Shambu into Applications.

This early build is ad-hoc signed, but Apple has not notarized it. After trying to open it, use **System Settings > Privacy & Security > Open Anyway** if macOS blocks it. Follow [Apple’s instructions](https://support.apple.com/en-us/102445). Do not disable Gatekeeper globally.

## Android

Download **Shambu-Android-arm64.apk** on the phone and open it. Android may ask you to allow installation from the browser or file manager you used. You can turn that permission off afterward.

This APK has a stable project signing key, held privately on the maintainer’s PC. If an older debug preview is installed, uninstall it first. That removes its local settings, so keep your server address handy.

## Connect

On the GPU PC, open Shambu’s Settings and copy the server URL and eight-character pairing code. On the other device, choose **Remote server**, enter the URL and code, and **Save**. Keep Tailscale connected on both devices.

Short codes require host companion version 0.2.0 or later. The [host companion guide](host-agent.md) covers installation and upgrades.

## Missing Ollama or Tailscale?

Shambu offers an **Install** action when it cannot find a needed local app.

- On Windows, Shambu asks Windows Package Manager to run the official installer. If Package Manager is unavailable, it opens the official download.
- On Mac, it opens the official download page.
- On Android, Tailscale opens in Google Play. Ollama runs on the GPU PC.

Finish installation and sign-in, then return to Shambu and refresh. An unreachable remote server does not mean you need Ollama installed on your phone or laptop.

Official downloads: [Ollama](https://ollama.com/download), [Tailscale](https://tailscale.com/download).

