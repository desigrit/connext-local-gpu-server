# Privacy and public files

This repository contains instructions and generic scripts. Your actual device configuration belongs in the ignored local files.

## What stays local

- `config.local.json`, including customized paths and settings.
- `.local/`, including logs, process identifiers, account names, and test results.
- Tailscale state, device identities, authentication keys, and account credentials.
- Ollama account keys and any environment files.
- Model weights, application databases, resumes, prompts, and inference results.
- Screenshots or exports that reveal device addresses or personal paths.

The scripts do not need a Tailscale auth key in source code. Sign in through the Tailscale application.

## Access to the inference API

Ollama's local API does not require authentication. A client-side API-key placeholder does not secure it. Tailnet access rules determine which remote devices can reach this setup. Permit access only to the devices or users intended to use the service. [Ollama authentication documentation](https://docs.ollama.com/api/authentication).

Tailscale secures the transport between connected devices. The HTTP URL shown in this guide is used inside that private connection; it should not become a public internet endpoint. This setup uses Serve for private access, not Funnel for public access. [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve).

The launcher sets `OLLAMA_NO_CLOUD=1` for its server process. This disables Ollama cloud features for that process. It does not control the privacy behavior of separate client applications, external tools, or other services. [Ollama local-only settings](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features).

## Before publishing a fork or reporting an issue

Review the exact files being committed:

```powershell
git status --short
git diff --cached
git ls-files
```

Check commit-author email settings too. Use a GitHub noreply address if you do not want a personal email in public commit metadata.

Ignore rules prevent accidental additions of common local files, but do not remove files that were already tracked. Do not force-add local configuration, logs, backups, model files, or credentials.

For an issue report, summarize the symptom, software versions, and relevant error. Redact paths, addresses, account identifiers, request content, and credentials from any excerpt. Avoid attaching the full runtime directory.

If a credential has already been published, revoke or rotate it. Removing it from the current file does not remove previous Git history.

## Pairing and release signing

The eight-character pairing code is temporary and single-use. It expires after five minutes, with a budget of five attempts. Pair over Tailscale or trusted HTTPS. The host's full random credential stays out of the visible pairing field and is saved on a paired device; it authorizes status reads and creation of further pairing codes. Pair only trusted devices. The monitor has no endpoint to run a model or control the PC.

Android release signing material stays in ignored, access-restricted local storage on the maintainer's PC. CI builds the unsigned APK. Only the signed APK and its public certificate go to the public release. Back up the local signing key and password securely to preserve future update compatibility.

## Update checks

On Windows and Mac, Shambu checks its public GitHub update feed at launch and periodically while visible. GitHub receives the network request, including the client IP address. Update checks do not send the server URL, pairing code, model list, GPU readings, or other diagnostics. Installer downloads start only when Update is clicked. Verified packages remain in memory until installation or app exit. Android does not check this feed or download app updates. The updater signing key stays in restricted local storage, separate from the Android signing key. Only public keys, signatures, release metadata, and signed packages are published.
