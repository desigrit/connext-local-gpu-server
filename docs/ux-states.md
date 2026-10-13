# Status and recovery previews

[Open the interactive state gallery](ux-states.html). The gallery uses captured, synthetic readings. It does not connect to or change a real server.

For a live development preview, run the app's Vite development server and open its local URL with ?demo=healthy. The preview selector covers all the states below. **Simulate recovery** changes the sample result to healthy and runs a preview check. These controls never appear in the installed app.

| State | What Shambu shows | Recovery |
| --- | --- | --- |
| Ready | Green dots, Active checks, and Connected - Just now below the heading. | No action needed. Checks refresh every five minutes. |
| Ollama offline | Red Unreachable, Disconnected, and visible guidance. Dependent checks remain unverified. | Open Ollama on the GPU PC, or use Edit address if the URL is wrong. Check again after fixing it. |
| Tailscale disconnected | Amber Disconnected. Ollama may still be available locally while the private route is unverified. | Open Tailscale and connect or sign in. For a host-side failure, do this on the GPU PC. |
| Forwarding missing | Amber Not configured. The server card has no invented private URL. | Restore the matching private TCP forward on the GPU PC using the [setup guide](../README.md), then check again. |
| Pairing key rejected | The direct Ollama check can stay green, while host checks say Key not accepted. | Choose Update the host pairing key, copy a current key from Shambu on the GPU PC, and save it in Settings on this device. |
| Host companion offline | Ollama can remain reachable while its host diagnostics are unverified. | Check the [host companion](host-agent.md), its private forward, and the host status URL in Settings. |
| CPU fallback | The reachable server remains connected. A visible CPU detected warning explains the model's allocation. | Check the GPU driver and Ollama's loaded-model allocation on the GPU PC. Restart Ollama only after its active work finishes. |
| No models | An amber Empty model library with a download instruction. | Open Ollama on the GPU PC, download a model, then check again. |
| Stale readings | Muted old statuses, Check needed, the reading age, and Refresh now. | Refresh once the app and connection are available. Stale data is never presented as a fresh all-clear. |
| Host not linked | Ollama can be connected, but host checks say Not linked. Unobserved GPU hours stay Idle. | Use Link host details and the optional pairing key to inspect the GPU PC's own checks. |

Launch links open the installed app on **this device**. See [native app links](native-launchers.md) for platform behavior. Opening another app does not mark a check healthy; only a new readiness result does that.

The last check reads **Just now** for less than two minutes, then **2 minutes ago**, **3 minutes ago**, and so on. Automatic checks run every five minutes while the app is visible and Settings is closed. A failed probe or a reading older than five minutes and thirty seconds marks existing evidence stale.

Hourly dots are filled only where qualifying GPU activity was observed. Hover, tap, or use the arrow keys for a tooltip such as **9 AM · Idle**. Hours use the device's local time zone, including daylight saving, without displaying the zone name. Minute offsets are retained where a local zone is offset by a fraction of an hour.

## Ollama offline

![Ollama offline with recovery actions](previews/offline.png)

## Pairing needs attention

![Rejected host key with a recovery link](previews/pairing.png)

## Phone

![Ollama offline on a phone](previews/mobile-offline.png)

All screenshots use example addresses and synthetic model readings. Regenerate them with app/scripts/render-state-previews.mjs while the local Vite server is running.
