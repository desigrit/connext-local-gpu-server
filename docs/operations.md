# Operations and troubleshooting

The commands below assume the example task name and port. If you customized either, substitute the values from `config.local.json`. Run task-management commands in an administrator PowerShell window when Windows requires it.

## Check the server

```powershell
Get-ScheduledTask -TaskName 'Connext-Ollama'
Get-ScheduledTaskInfo -TaskName 'Connext-Ollama'
Invoke-RestMethod http://127.0.0.1:11434/api/version
ollama ps
nvidia-smi
Get-Content .\.local\server-11434.json
Get-Content .\.local\server-11434.err.log -Tail 40
```

The task should be running and the local status should report CUDA. The JSON records the last startup state, so also check the live endpoint and task rather than relying on that file alone. An empty `ollama ps` list is normal when no model is loaded.

Generated logs and status files can contain local paths, model names, device information, and request metadata. Keep them private.

## Keep the plugged-in PC available

Windows sleep stops access even when Tailscale and Ollama are configured correctly. If you want the PC to remain awake, record the existing setting and disable automatic AC sleep:

```powershell
New-Item -ItemType Directory -Path .local -Force | Out-Null
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE > .\.local\power-before.txt
powercfg /change standby-timeout-ac 0
```

This is a separate, deliberate power-setting change. The installer does not make it automatically. To reverse it, restore your previous value in Windows power settings. The query records seconds, while `powercfg /change standby-timeout-ac` accepts minutes.

Display sleep can remain enabled. Manual sleep, shutdown, a power loss, a disconnected network, or a disk-unlock screen still makes the host unavailable.

## Pause, restart, and update

Disable the task before stopping it for maintenance. Stopping it alone lets the recurring trigger start it again.

```powershell
Disable-ScheduledTask -TaskName 'Connext-Ollama'
Stop-ScheduledTask -TaskName 'Connext-Ollama'
```

Wait for the local port to close. Apply the intended Ollama update or edit the local configuration. Confirm that the ordinary Ollama app has not taken over the port, then resume:

```powershell
Enable-ScheduledTask -TaskName 'Connext-Ollama'
Start-ScheduledTask -TaskName 'Connext-Ollama'
```

Run a small inference check after an update. Recheck the CUDA log format if the launcher starts failing immediately. Never use a server restart to interrupt somebody else's active inference without coordinating it.

Changing `TaskName` or moving the checkout/configuration file requires removing the old task first and reinstalling. Changing the port also requires updating the Tailscale forward and client URLs.

## Test recovery

This test interrupts the server. Choose a maintenance window with no client requests or other GPU work.

Unload cached models only after active work has finished:

```powershell
ollama ps
ollama stop qwen3:8b
```

Substitute the model actually shown by `ollama ps`. Then run:

```powershell
.\scripts\Test-Recovery.ps1 -StopServer
```

The script checks that the task belongs to this checkout, refuses to proceed while a model is loaded, stops the task, and waits for the recurring trigger to restore a new Ollama process with CUDA. Its result is saved under `.local`. This is a process-recovery check, not a full reboot test.

## Test a real reboot before traveling

1. Finish active work and save open documents.
2. Restart the GPU PC yourself.
3. Leave Windows at the sign-in screen.
4. On another device, keep Tailscale connected and open the host's version URL.
5. Allow time for Windows, networking, and GPU discovery to initialize.
6. Run a short model request from that device and confirm GPU allocation.
7. Repeat the network check over mobile data.

A version response proves the API is reachable. It does not prove that the next model request will use CUDA. Keep those checks separate.

## Ollama uses CPU after a reboot

Check `ollama ps`, `nvidia-smi`, and the server log. In the source setup, one Ollama process discovered no GPUs at startup while a newly started process discovered CUDA correctly. Restarting restored GPU inference; the precise cause of the initial discovery failure was not established.

The launcher handles that startup outcome by exiting so recovery can retry. If it keeps failing, inspect the driver and Ollama logs before repeatedly changing settings. GPU discovery happens during Ollama startup and can fail independently of whether the GPU is visible to another utility. [Ollama troubleshooting](https://docs.ollama.com/troubleshooting).

Also check for inherited environment settings that deliberately hide devices or select a CPU backend, including `CUDA_VISIBLE_DEVICES` and `OLLAMA_LLM_LIBRARY`. Change only settings you understand.

If the GPU is discovered but a model is split between CPU and GPU, inspect model size, available VRAM, context length, and other loaded workloads. The startup guard does not prevent memory-driven partial offloading.

## Models disappeared after enabling background startup

Compare `ModelsDirectory` with the folder used by the existing Ollama app. Check both `manifests` and `blobs`. Downloading a second copy is unnecessary when the original files are already on another local drive.

The task runs under the account that installed it. A different account, a mapped drive, or a file that requires interactive decryption can make an otherwise valid path inaccessible.

## Works locally, but not from another device

Check in this order:

1. The host's local version endpoint.
2. Tailscale is connected on both devices.
3. The host's current Tailscale IPv4 address.
4. `tailscale serve status` includes the intended TCP forwarding.
5. Tailnet access policy permits the client to reach that host and port.
6. The PC is awake and connected.

The address needed on the client belongs to the GPU PC. Its Wi-Fi address and the client's own Tailscale address are different addresses.

## The IP works, but a hostname returns HTTP 403

This was observed with raw TCP forwarding to a loopback-bound Ollama server. TCP forwarding preserves the request's Host header, and Ollama can reject a hostname even when DNS resolves correctly.

Use the Tailscale IPv4 address as the baseline. If a hostname is important, configure and test an HTTP reverse proxy that supplies an accepted upstream Host header. A 403 in this case does not mean you need to expose Ollama on every interface.

## A browser application cannot call the API

Browser origin restrictions, mixed-content rules, and application connection settings are separate from Tailscale reachability. A successful version check does not configure CORS.

Prefer an application's backend connection to Ollama. If an allowed origin must be added, scope it to the application you control and restart the server after the change. Do not set a wildcard origin as a general fix. [Ollama origin settings](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama).

## Remove the background setup

From this checkout, with its original local configuration:

```powershell
.\scripts\Uninstall-Startup.ps1
```

The script verifies the task action, disables recovery, stops the task, and removes its registration. It preserves models, logs, and configuration. Re-enable Ollama in Windows Startup apps if you want the ordinary app to own startup again.

To remove only this Tailscale forwarding rule, use the same configured port:

```powershell
$tailscale = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
& $tailscale serve --tcp=11434 off
```

Avoid resetting every Serve rule if the PC hosts other services. Restore any power settings you changed separately.
