// Synthetic preview data only. Never used by a native build.
import type { Settings, Snapshot } from './types';
export function demoSnapshot(settings: Settings, scenario: string): Snapshot {
  const remote = settings.mode === 'remote';
  const currentHour = Math.floor(Date.now() / 3600000) * 3600000;
  const hourlyCounts = [0, 0, 0, 1, 2, 0, 0, 3, 5, 2, 0, 0, 1, 0, 4, 6, 2, 0, 0, 3, 1, 2, 0, 0];
  const bursts = hourlyCounts.flatMap((count, hour) => Array.from({ length: count }, (_, index) => currentHour - (23 - hour) * 3600000 + (index + 1) * 60000));
  const result: Snapshot = {
    gpuHistory: remote && !settings.diagnosticsKey ? null : { source: 'ollama-gpu-estimate', sampledAtMs: Date.now(), bursts, activeHours: [...new Set(bursts.map(time => Math.floor(time / 3600000) * 3600000)), currentHour - 30 * 3600000] },
    hostDetails: remote ? 'not-linked' : 'local', checkedAtMs: Date.now(), endpoint: settings.endpoint, mode: settings.mode, version: '0.0.0-demo',
    externalEndpoint: remote ? settings.endpoint : 'http://192.0.2.10:11434',
    gpuName: remote && !settings.diagnosticsKey ? null : 'NVIDIA Quadro RTX 8000',
    gpuMetrics: remote && !settings.diagnosticsKey ? null : { sampleAgeMs: 500, devices: [{ index: 0, loadPercent: 7, memoryUsedMib: 1741, memoryTotalMib: 49152 }] },
    installedModels: [{ name: 'qwen3:8b', size: 4_900_000_000 }, { name: 'qwen2.5-coder:14b', size: 9_000_000_000 }, { name: 'example-embed:latest', size: 274_000_000 }],
    latencyMs: 12, modelCount: 3, loadedModels: [],
    checks: [
      { id: 'ollama', title: remote ? 'Ollama server' : 'Ollama local URL', state: 'ok', label: 'Active', detail: 'Ollama replied in 12 ms.', help: null },
      { id: 'tailscale', title: 'Tailscale', state: 'ok', label: 'Active', detail: 'Tailscale reports this device online. Peer access depends on your tailnet policy.', help: null },
      { id: 'forwarding', title: remote ? 'Server route' : 'Forwarding', state: 'ok', label: remote ? 'Reachable' : 'Active', detail: remote ? "This device can reach the server. The host's forwarding configuration is not inspected remotely." : "The matching TCP forward responded through this PC's Tailscale address.", help: 'Check from another device before traveling.' },
      { id: 'gpu', title: 'GPU inference', state: 'idle', label: 'Idle', detail: remote ? 'No model is loaded on the server. GPU hardware and driver readiness have not been verified.' : 'An NVIDIA GPU is visible to the driver. No model is loaded, so Ollama GPU use is not yet verified.', help: null },
      { id: 'models', title: 'Model library', state: 'ok', label: '3 available', detail: 'Models are installed on the server. This check does not load them.', help: null },
    ],
  };
  if (scenario === 'offline') {
    result.checks[0] = { ...result.checks[0], state: 'error', label: 'Unreachable', detail: 'Could not connect to this address.', help: 'Check that Ollama is running and the port is correct.' };
    result.checks[2] = { ...result.checks[2], state: 'warning', label: 'Not responding', detail: 'A matching forward is configured, but the Ollama check through it failed.' };
    result.checks[3] = { ...result.checks[3], state: 'unknown', label: 'Unverified', detail: 'The server did not reply.' };
    result.checks[4] = { ...result.checks[4], state: 'unknown', label: 'Unverified', detail: 'The server did not reply.' };
    result.latencyMs = null; result.modelCount = null; result.version = null; result.installedModels = []; result.gpuHistory = null;
  }
  if (scenario === 'cpu') {
    result.checks[3] = { ...result.checks[3], state: 'warning', label: 'CPU detected', detail: 'At least one loaded model has no GPU memory allocation.', help: 'Check ollama ps and the GPU driver. Restart Ollama only after active work finishes.' };
  }
  if (remote) {
    result.checks[1] = { ...result.checks[1], title: 'Tailscale on server', state: 'unknown', label: 'Not linked', detail: 'Link the host companion to see the server’s own Tailscale status.', help: 'Copy the pairing key from Shambu on the GPU PC, then paste it into Settings here.' };
    result.checks[2] = { ...result.checks[2], title: 'Forwarding', state: 'unknown', label: 'Not linked', detail: 'The Ollama endpoint is reachable. Its forwarding configuration has not been inspected.' };
  }
  if (remote && settings.diagnosticsKey) {
    result.hostDetails = 'linked';
    result.serverName = 'The Jungle PC';
    result.checks[1] = { ...result.checks[1], state: 'ok', label: 'Active', help: null, detail: 'The paired host companion reports Tailscale online on the GPU PC.' };
    result.checks[2] = { ...result.checks[2], state: 'ok', label: 'Active', detail: 'The paired host companion verified its matching TCP forward.' };
  }
  const recovered = new URLSearchParams(location.search).get('recovered') === '1';
  if (remote && recovered) {
    result.hostDetails = 'linked';
    result.checks[1] = { ...result.checks[1], state: 'ok', label: 'Active', help: null };
    result.checks[2] = { ...result.checks[2], state: 'ok', label: 'Active', help: null };
    result.gpuName = 'NVIDIA Quadro RTX 8000';
  }
  if (scenario === 'tailscale') {
    result.externalEndpoint = null;
    result.checks[1] = { ...result.checks[1], state: 'warning', label: 'Disconnected', detail: 'Tailscale is signed out on the GPU PC.', help: 'Open Tailscale and sign in again, then check the connection.' };
    result.checks[2] = { ...result.checks[2], state: 'unknown', label: 'Unverified', detail: 'Connect Tailscale before checking the private route.' };
  }
  if (scenario === 'forwarding') {
    result.externalEndpoint = null;
    result.checks[2] = { ...result.checks[2], state: 'warning', label: 'Not configured', detail: 'Ollama works on this PC, but its private route is missing.', help: 'On the GPU PC, restore the Tailscale TCP forward to the local Ollama port, then check again.' };
  }
  if (scenario === 'pairing' || scenario === 'companion') {
    result.hostDetails = scenario === 'pairing' ? 'unauthorized' : 'unreachable';
    for (const index of [1, 2]) result.checks[index] = { ...result.checks[index], state: 'unknown', label: scenario === 'pairing' ? 'Key not accepted' : 'Unverified' };
    result.gpuName = null; result.gpuHistory = null; result.serverName = null;
  }
  if (scenario === 'empty') {
    result.installedModels = []; result.modelCount = 0; result.gpuHistory = null;
    result.checks[4] = { ...result.checks[4], state: 'warning', label: 'Empty', detail: 'Ollama is responding, but no models are installed.', help: 'Download a model in Ollama on the GPU PC, then check again.' };
  }
  if (scenario === 'stale') {
    result.checkedAtMs = Date.now() - 7 * 60000;
    if (result.gpuHistory) result.gpuHistory.sampledAtMs = result.checkedAtMs;
  }
  if (['offline', 'pairing', 'companion'].includes(scenario)) result.gpuMetrics = null;
  return result;
}
