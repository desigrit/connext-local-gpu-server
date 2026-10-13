export type Mode = 'host' | 'remote';
export type CheckState = 'ok' | 'warning' | 'error' | 'unknown' | 'idle';
export type HostDetails = 'local' | 'linked' | 'not-linked' | 'unreachable' | 'unauthorized';
export interface Settings { mode: Mode; endpoint: string; name: string; diagnosticsKey: string; diagnosticsUrl: string }
export interface Check { id: string; title: string; state: CheckState; label: string; detail: string; help: string | null }
export interface LoadedModel { name: string; size: number; sizeVram: number | null }
export interface GpuHistory { sampledAtMs: number; bursts: number[] }
export interface Snapshot {
  gpuHistory?: GpuHistory | null;
  checkedAtMs: number; endpoint: string; mode: Mode; hostDetails: HostDetails; checks: Check[];
  version: string | null; latencyMs: number | null; modelCount: number | null; loadedModels: LoadedModel[];
}
