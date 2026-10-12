# What can run behind the connection?

The private connection can carry requests to more than one service. Each service still needs its own runtime, port, startup behavior, and client support.

## Connection options

| Approach | Fits | Extra work |
| --- | --- | --- |
| Ollama plus Tailscale | Personal devices at home and while traveling. This guide implements it. | Install Tailscale on each device and grant access. |
| Direct LAN access | Devices on the same local network. | Bind the service to an appropriate LAN interface and restrict firewall access. Remote travel access needs another solution. |
| A self-managed VPN | People who want to operate the VPN themselves. | Manage routing, peer configuration, keys, and reachability. |
| An authenticated web gateway | Sharing a specific application with users who will not install a VPN. | Add authentication, TLS, access controls, and application-specific protections before exposing it. |

Start with the private connection for personal use. A public endpoint adds operational work and is unnecessary for the setup documented here.

## Chat and application inference

[Ollama](https://github.com/ollama/ollama) provides the model server. Applications such as [Zebby](https://github.com/desigrit/zebby-the-scout) can use that server for inference. The application's data remains a separate concern from where the model runs.

For a browser chat interface, explore [Open WebUI](https://github.com/open-webui/open-webui). Configure its backend to reach Ollama, and expose the UI privately through Tailscale. Connection details differ if the UI runs in a container: a container's loopback address refers to that container.

This repository configures the inference API. It does not install a chat UI.

## Images

[ComfyUI](https://github.com/Comfy-Org/ComfyUI) is an option for image-generation workflows with a node interface and API. It requires its own installation, models, and compatible GPU dependencies.

Run it as a separate service and forward its chosen local port through Tailscale. Do not assume an Ollama chat connection setting can also control image-generation workflows.

## Audio

| Project | Role | Integration note |
| --- | --- | --- |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Speech-to-text inference. | Select a supported backend and an appropriate server example for remote requests. |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Speech-to-text inference with CTranslate2. | It is a Python library; a client usually needs a separate API wrapper. |
| [Piper](https://github.com/OHF-Voice/piper1-gpl) | Local text-to-speech. | Check the chosen runtime, model, and server interface. Local execution does not automatically mean GPU execution. |

These are starting points for a later setup. They are not installed or validated by the scripts here.

## Sharing one GPU

Chat, image, and audio processes compete for VRAM and compute. Begin with one workload at a time. Unload unused models, limit concurrency, and test each service independently before running them together.

A network connection does not provide a shared GPU scheduler. If several applications will submit jobs simultaneously, consider a queue or application gateway after the individual services work.

Forward each additional service only to its intended local listener, and give it the same startup, recovery, privacy, and remote-access checks as Ollama.
