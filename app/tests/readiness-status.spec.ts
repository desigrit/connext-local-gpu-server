import { expect, test } from '@playwright/test';
import { getReadinessStatus } from '../src/readiness';
import type { Check, CheckState, HostDetails, Snapshot } from '../src/types';

function fixture(): Snapshot {
  const checks: Check[] = ['ollama', 'tailscale', 'forwarding', 'gpu', 'models'].map(id => ({
    id, title: id, state: id === 'gpu' ? 'idle' : 'ok',
    label: 'Synthetic check', detail: 'Synthetic fixture', help: null,
  }));
  return {
    checkedAtMs: 1, endpoint: 'http://127.0.0.1:11434', mode: 'host', hostDetails: 'local',
    checks, version: 'fixture', latencyMs: 1, modelCount: 1, loadedModels: [],
    installedModels: [{ name: 'fixture:latest', size: 1 }],
  };
}

function withState(snapshot: Snapshot, id: string, state: CheckState): Snapshot {
  return { ...snapshot, checks: snapshot.checks.map(check => check.id === id ? { ...check, state } : check) };
}

test('a verified connection stays green while the GPU is idle', () => {
  expect(getReadinessStatus(fixture())).toEqual({ label: 'Connected', tone: 'ok', reason: 'healthy' });
});

test('a linked remote host uses server diagnostics and may be green', () => {
  const remote: Snapshot = { ...fixture(), mode: 'remote', hostDetails: 'linked', endpoint: 'http://192.0.2.10:11434' };
  expect(getReadinessStatus(remote).tone).toBe('ok');
});

test('disconnected Tailscale prevents green while Ollama still responds', () => {
  const snapshot = withState(fixture(), 'tailscale', 'warning');
  expect(getReadinessStatus(snapshot)).toEqual({ label: 'Connection issue', tone: 'warning', reason: 'connection-issue' });
});

test('missing or failing forwarding is a connection issue', () => {
  expect(getReadinessStatus(withState(fixture(), 'forwarding', 'warning'))).toMatchObject({
    label: 'Connection issue', tone: 'warning',
  });
  expect(getReadinessStatus(withState(fixture(), 'forwarding', 'error'))).toMatchObject({
    label: 'Connection issue', tone: 'error',
  });
});

test('unknown or idle required connection checks cannot produce green', () => {
  for (const id of ['ollama', 'tailscale', 'forwarding']) {
    for (const state of ['unknown', 'idle'] as const) {
      expect(getReadinessStatus(withState(fixture(), id, state))).toEqual({
        label: 'Check needed', tone: 'warning', reason: 'connection-unverified',
      });
    }
  }
});

test('missing or duplicate required checks cannot produce green', () => {
  for (const id of ['ollama', 'tailscale', 'forwarding', 'gpu', 'models']) {
    const snapshot = fixture();
    const existing = snapshot.checks.find(check => check.id === id)!;
    expect(getReadinessStatus({ ...snapshot, checks: snapshot.checks.filter(check => check.id !== id) }).tone).not.toBe('ok');
    expect(getReadinessStatus({ ...snapshot, checks: [...snapshot.checks, existing] }).tone).not.toBe('ok');
  }
});

test('unverified remote host details cannot be replaced by a reachable Ollama API', () => {
  for (const hostDetails of ['not-linked', 'unauthorized', 'unreachable', 'local'] as HostDetails[]) {
    const snapshot: Snapshot = { ...fixture(), mode: 'remote', hostDetails };
    expect(getReadinessStatus(snapshot)).toEqual({
      label: 'Check needed', tone: 'warning', reason: 'host-unverified',
    });
  }
});

test('CPU use and an empty model library are readiness warnings, not disconnections', () => {
  for (const id of ['gpu', 'models']) {
    expect(getReadinessStatus(withState(fixture(), id, 'warning'))).toEqual({
      label: 'Needs attention', tone: 'warning', reason: 'readiness-warning',
    });
  }
});

test('unverified GPU or model information requires a check', () => {
  for (const id of ['gpu', 'models']) {
    expect(getReadinessStatus(withState(fixture(), id, 'unknown'))).toEqual({
      label: 'Check needed', tone: 'warning', reason: 'readiness-unverified',
    });
  }
});

test('an unreachable Ollama API is red even while other checks pass or refresh runs', () => {
  const snapshot = withState(fixture(), 'ollama', 'error');
  expect(getReadinessStatus(snapshot, { checking: true })).toEqual({
    label: 'Disconnected', tone: 'error', reason: 'ollama-unreachable',
  });
});

test('stale readings override old success and old failure with an unverified status', () => {
  for (const snapshot of [fixture(), withState(fixture(), 'ollama', 'error')]) {
    expect(getReadinessStatus(snapshot, { stale: true })).toEqual({
      label: 'Check needed', tone: 'unknown', reason: 'stale',
    });
  }
});

test('before the first result, only an active check says Checking', () => {
  expect(getReadinessStatus(null)).toEqual({ label: 'Not checked', tone: 'unknown', reason: 'unchecked' });
  expect(getReadinessStatus(null, { checking: true })).toEqual({ label: 'Checking', tone: 'unknown', reason: 'checking' });
});