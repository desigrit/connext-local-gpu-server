import { invoke, isTauri } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import type { Settings, Snapshot } from './types';

export const native = isTauri();
export const android = /Android/i.test(navigator.userAgent);
export const demo = !native && import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
export const defaultSettings: Settings = {
  mode: android ? 'remote' : 'host',
  endpoint: android ? '' : 'http://127.0.0.1:11434',
  name: 'My GPU server', diagnosticsKey: '', diagnosticsUrl: '',
};

export async function loadSettings(): Promise<Settings> {
  if (native) return invoke('load_settings');
  if (demo) {
    const saved = sessionStorage.getItem('shambu-demo-settings');
    if (saved) return { ...defaultSettings, ...JSON.parse(saved) } as Settings;
    if (['remote', 'pairing', 'companion'].includes(new URLSearchParams(location.search).get('demo') ?? '')) {
      return { ...defaultSettings, mode: 'remote', endpoint: 'http://192.0.2.10:11434', name: 'Home server' };
    }
  }
  return defaultSettings;
}

export type ConnectionIssue = { field: 'name' | 'endpoint' | 'diagnosticsKey' | 'diagnosticsUrl' | null; message: string };

export function validateSettings(settings: Settings): ConnectionIssue | null {
  if (!settings.name.trim() || settings.name.trim().length > 60) return { field: 'name', message: 'Give your server a name between 1 and 60 characters.' };
  let url: URL;
  try { url = new URL(settings.endpoint.trim()); } catch { return { field: 'endpoint', message: 'Enter a full URL beginning with http:// or https://.' }; }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return { field: 'endpoint', message: 'Use an http:// or https:// server URL.' };
  if (url.username || url.password || url.search || url.hash) return { field: 'endpoint', message: 'Use a URL without credentials, a query, or a fragment.' };
  if (url.pathname !== '/') return { field: 'endpoint', message: 'Use the base URL only, without /api/version or /v1.' };
  const loopback = url.hostname === 'localhost' || /^127\./.test(url.hostname) || url.hostname === '[::1]';
  if (settings.mode === 'remote' && loopback) return { field: 'endpoint', message: 'Localhost means this device. Enter the address of your GPU PC.' };
  if (settings.mode === 'host' && !loopback) return { field: 'endpoint', message: 'Choose Remote server to check another device.' };
  if (settings.mode === 'remote' && settings.diagnosticsKey && !/^[a-f0-9]{64}$/.test(settings.diagnosticsKey.trim())) return { field: 'diagnosticsKey', message: 'Paste the complete pairing key copied from Shambu on the GPU PC.' };
  if (settings.mode === 'remote' && settings.diagnosticsUrl) {
    let diagnostics: URL;
    try { diagnostics = new URL(settings.diagnosticsUrl.trim()); } catch { return { field: 'diagnosticsUrl', message: 'Enter a complete host status URL, or leave it blank.' }; }
    if (!['http:', 'https:'].includes(diagnostics.protocol) || diagnostics.hostname !== url.hostname || diagnostics.username || diagnostics.password || diagnostics.search || diagnostics.hash || diagnostics.pathname !== '/') return { field: 'diagnosticsUrl', message: 'The host status URL must use the same server address, with no credentials or path.' };
  }
  return null;
}

export async function saveSettings(settings: Settings, pairingCode = ''): Promise<Settings> {
  const error = validateSettings(settings);
  if (error) throw new Error(error.message);
  const normalized = {
    ...settings, name: settings.name.trim(), endpoint: settings.endpoint.trim().replace(/\/$/, ''),
    diagnosticsKey: settings.diagnosticsKey.trim(), diagnosticsUrl: settings.diagnosticsUrl.trim().replace(/\/$/, ''),
  };
  if (pairingCode && !/^[A-HJ-NP-Z2-9]{8}$/.test(pairingCode)) throw new Error('Enter the 8-character code shown on your GPU PC.');
  if (native) return invoke('save_settings', { settings: normalized, pairingCode: pairingCode || null });
  if (demo) {
    if (pairingCode) normalized.diagnosticsKey = 'a'.repeat(64);
    // Preview sessions intentionally never retain credentials.
    sessionStorage.setItem('shambu-demo-settings', JSON.stringify({ ...normalized, diagnosticsKey: '' }));
    return normalized;
  }
  throw new Error('Open the installed app to connect to your server.');
}

export async function copyText(text: string) {
  if (native) return writeText(text);
  return navigator.clipboard.writeText(text);
}

export interface PairingCode { code: string; expiresAtMs: number }
let pendingPairingCode: Promise<PairingCode> | null = null;
export async function getPairingCode(): Promise<PairingCode> {
  if (native) {
    pendingPairingCode ??= invoke<PairingCode>('get_pairing_code').finally(() => { pendingPairingCode = null; });
    return pendingPairingCode;
  }
  if (demo) return { code: 'SHAMBU42', expiresAtMs: Date.now() + 300000 };
  throw new Error('Open Shambu on your GPU PC to create a code.');
}

export async function checkReadiness(settings: Settings): Promise<Snapshot> {
  if (native) return invoke('check_readiness', { settings });
  if (demo) {
    await new Promise(resolve => setTimeout(resolve, 450));
    const { demoSnapshot } = await import('./demo');
    return demoSnapshot(settings, new URLSearchParams(location.search).get('demo') ?? 'healthy');
  }
  throw new Error('Open the installed app to check your server.');
}

export type CompanionApp = 'tailscale' | 'ollama';

export async function openCompanionApp(target: CompanionApp): Promise<string> {
  if (demo) return `Opening ${target === 'ollama' ? 'Ollama' : 'Tailscale'}. Check the system tray.`;
  if (!native) throw new Error('Open the installed Shambu app to launch apps on this device.');
  try {
    return await invoke<string>('open_companion_app', { target });
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : 'Could not open the app. Try your device\'s app launcher.');
  }
}

export type Availability = 'installed' | 'missing' | 'unknown' | 'unsupported';
export async function companionAvailability(target: CompanionApp): Promise<Availability> {
  if (native) return invoke('companion_availability', { target });
  if (demo) return new URLSearchParams(location.search).get('demo') === 'missing' ? 'missing' : 'installed';
  return 'unknown';
}
export async function installCompanionApp(target: CompanionApp): Promise<string> {
  if (!native) throw new Error('Open the installed Shambu app to install apps on this device.');
  return invoke('install_companion_app', { target });
}
