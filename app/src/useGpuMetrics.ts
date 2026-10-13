import { useEffect, useState } from 'react';
import { getGpuMetrics, validateSettings } from './bridge';
import type { GpuMetrics, Settings } from './types';

const REFRESH_MS = 5_000;
const MAX_AGE_MS = 15_000;

export function useGpuMetrics(settings: Settings | null) {
  const [reading, setReading] = useState<{ connection: Settings; metrics: GpuMetrics } | null>(null);
  useEffect(() => {
    if (!settings || validateSettings(settings)) return;
    let disposed = false;
    let pending = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const clearReading = () => { clearTimeout(expiryTimer); setReading(null); };
    const refresh = async () => {
      if (disposed || document.hidden || pending) return;
      pending = true;
      try {
        const metrics = await getGpuMetrics(settings);
        if (disposed || document.hidden) return;
        clearTimeout(expiryTimer);
        if (metrics && metrics.devices.length && Number.isFinite(metrics.sampleAgeMs) && metrics.sampleAgeMs >= 0 && metrics.sampleAgeMs < MAX_AGE_MS) {
          setReading({ connection: settings, metrics });
          expiryTimer = setTimeout(clearReading, MAX_AGE_MS - metrics.sampleAgeMs);
        } else clearReading();
      } catch {
        if (!disposed) clearReading();
      } finally {
        pending = false;
        if (!disposed && !document.hidden) refreshTimer = setTimeout(() => void refresh(), REFRESH_MS);
      }
    };
    const onVisibility = () => {
      clearTimeout(refreshTimer);
      if (document.hidden) clearReading();
      else void refresh();
    };
    void refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      clearTimeout(expiryTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [settings]);
  // A response from the previous server must never appear beneath the new one's name.
  return reading?.connection === settings ? reading.metrics : null;
}
