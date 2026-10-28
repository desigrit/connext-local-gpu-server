export type Mode = 'host' | 'remote';
export type CheckState = 'ok' | 'warning' | 'error' | 'unknown' | 'idle';
export type HostDetails = 'local' | 'linked' | 'not-linked' | 'unreachable' | 'unauthorized';
export interface Settings { mode: Mode; endpoint: string; name: string; diagnosticsKey: string; diagnosticsUrl: string }
export interface Check { id: string; title: string; state: CheckState; label: string; detail: string; help: string | null }
export interface InstalledModel { name: string; size: number; parameterSize?: string | null; quantizationLevel?: string | null }
export interface LoadedModel extends InstalledModel { sizeVram: number | null }
export interface GpuHistory { source: 'ollama-gpu-estimate'; sampledAtMs: number; bursts: number[]; activeHours: number[] }
export interface GpuReading { index: number; loadPercent: number | null; memoryUsedMib: number | null; memoryTotalMib: number | null }
export interface GpuMetrics { sampleAgeMs: number; devices: GpuReading[] }
export interface Snapshot {
  serverName?: string | null;
  gpuHistory?: GpuHistory | null;
  gpuMetrics?: GpuMetrics | null;
  externalEndpoint?: string | null; gpuName?: string | null; installedModels: InstalledModel[];
  checkedAtMs: number; endpoint: string; mode: Mode; hostDetails: HostDetails; checks: Check[];
  version: string | null; latencyMs: number | null; modelCount: number | null; loadedModels: LoadedModel[];
}
