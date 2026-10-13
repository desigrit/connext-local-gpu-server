import type { Check, Snapshot } from './types';

export type ReadinessTone = 'ok' | 'warning' | 'error' | 'unknown';
export type ReadinessLabel =
  | 'Connected'
  | 'Connection issue'
  | 'Needs attention'
  | 'Check needed'
  | 'Disconnected'
  | 'Checking'
  | 'Not checked';
export type ReadinessReason =
  | 'healthy'
  | 'unchecked'
  | 'checking'
  | 'stale'
  | 'ollama-unreachable'
  | 'connection-issue'
  | 'connection-unverified'
  | 'host-unverified'
  | 'readiness-warning'
  | 'readiness-unverified';

export interface ReadinessStatus {
  label: ReadinessLabel;
  tone: ReadinessTone;
  reason: ReadinessReason;
}

export interface ReadinessContext {
  /** Set for expired readings or a failed refresh, using the same rule as the rows. */
  stale?: boolean;
  /** Used before the first result. Fresh last-known failures remain visible during refresh. */
  checking?: boolean;
}

function singleCheck(snapshot: Snapshot, id: string): Check | undefined {
  const matches = snapshot.checks.filter(check => check.id === id);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Aggregate the server's connection and readiness checks, not the client device's state.
 * The caller supplies freshness through context.stale; a supplied snapshot is otherwise
 * considered fresh. Idle GPU use is normal and does not require loading a model.
 */
export function getReadinessStatus(
  snapshot: Snapshot | null,
  context: ReadinessContext = {},
): ReadinessStatus {
  if (!snapshot) {
    return context.checking
      ? { label: 'Checking', tone: 'unknown', reason: 'checking' }
      : { label: 'Not checked', tone: 'unknown', reason: 'unchecked' };
  }
  if (context.stale) {
    return { label: 'Check needed', tone: 'unknown', reason: 'stale' };
  }
  if (snapshot.checks.some(check => check.id === 'ollama' && check.state === 'error')) {
    return { label: 'Disconnected', tone: 'error', reason: 'ollama-unreachable' };
  }

  const connection = ['ollama', 'tailscale', 'forwarding'].map(id => singleCheck(snapshot, id));
  if (connection.some(check => check?.state === 'error')) {
    return { label: 'Connection issue', tone: 'error', reason: 'connection-issue' };
  }
  if (connection.some(check => check?.state === 'warning')) {
    return { label: 'Connection issue', tone: 'warning', reason: 'connection-issue' };
  }

  const hostVerified = snapshot.mode === 'host'
    ? snapshot.hostDetails === 'local'
    : snapshot.hostDetails === 'linked';
  if (!hostVerified) {
    return { label: 'Check needed', tone: 'warning', reason: 'host-unverified' };
  }
  // Missing, duplicate, unknown, or idle connection checks cannot prove connectivity.
  if (connection.some(check => check?.state !== 'ok')) {
    return { label: 'Check needed', tone: 'warning', reason: 'connection-unverified' };
  }

  const gpu = singleCheck(snapshot, 'gpu');
  const models = singleCheck(snapshot, 'models');
  if ([gpu, models].some(check => check?.state === 'warning' || check?.state === 'error')) {
    return { label: 'Needs attention', tone: 'warning', reason: 'readiness-warning' };
  }
  if ((gpu?.state !== 'ok' && gpu?.state !== 'idle') || models?.state !== 'ok') {
    return { label: 'Check needed', tone: 'warning', reason: 'readiness-unverified' };
  }
  return { label: 'Connected', tone: 'ok', reason: 'healthy' };
}