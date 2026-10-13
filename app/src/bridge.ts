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
    if (new URLSearchParams(location.search).get('demo') === 'remote') {
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

export async function saveSettings(settings: Settings): Promise<Settings> {
  const error = validateSettings(settings);
  if (error) throw new Error(error.message);
  const normalized = {
    ...settings, name: settings.name.trim(), endpoint: settings.endpoint.trim().replace(/\/$/, ''),
    diagnosticsKey: settings.diagnosticsKey.trim(), diagnosticsUrl: settings.diagnosticsUrl.trim().replace(/\/$/, ''),
  };
  if (native) return invoke('save_settings', { settings: normalized });
  if (demo) {
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

export async function copyHostKey() {
  if (!native) throw new Error('Copy the pairing key from the installed app on your GPU PC.');
  const key = await invoke<string>('get_host_pairing_key');
  await writeText(key);
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
