import { Channel, invoke } from '@tauri-apps/api/core';
import { native, demo, android } from './bridge';

export interface AppUpdate { version: string }
export interface DownloadProgress { downloaded: number; total: number | null }
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let previewAttempts = 0;
let pendingCheck: Promise<AppUpdate | null> | null = null;

// The preview never contacts GitHub or invokes an installer.
const preview = () => demo ? new URLSearchParams(location.search).get('update') : null;
export function checkAppUpdate(): Promise<AppUpdate | null> {
  if (android) return Promise.resolve(null);
  if (!pendingCheck) {
    pendingCheck = (native ? invoke<AppUpdate | null>('check_app_update') : Promise.resolve(preview() ? { version: '1.1.0' } : null))
      .finally(() => { pendingCheck = null; });
  }
  return pendingCheck;
}

export async function downloadAppUpdate(onProgress: (progress: DownloadProgress) => void): Promise<void> {
  if (android) throw new Error('Android updates are managed by the Play Store.');
  if (native) {
    const channel = new Channel<DownloadProgress>();
    channel.onmessage = onProgress;
    return invoke('download_app_update', { onProgress: channel });
  }
  if (!preview()) throw new Error('Open the Shambu app to update.');
  previewAttempts += 1;
  for (let downloaded = 0; downloaded <= 100; downloaded += 10) {
    onProgress({ downloaded, total: preview() === 'unknown-size' ? null : 100 });
    await pause(180);
    if (preview() === 'download-error' && previewAttempts === 1 && downloaded === 40) {
      throw new Error('Download interrupted. Check your connection and retry.');
    }
  }
  // A finished transfer is not the same as a verified package.
  await pause(400);
}

export async function installAppUpdate(): Promise<void> {
  if (android) throw new Error('Android updates are managed by the Play Store.');
  if (native) return invoke('install_app_update');
  if (!preview()) throw new Error('Open the Shambu app to update.');
  await pause(350);
  if (preview() === 'install-error') throw new Error('Could not install the update. Close other Shambu windows and retry.');
  document.documentElement.dataset.previewUpdateInstalled = 'true';
}
