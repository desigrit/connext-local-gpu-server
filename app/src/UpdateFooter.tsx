import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownload16Regular } from '@fluentui/react-icons';
import { android, native, demo } from './bridge';
import { checkAppUpdate, downloadAppUpdate, installAppUpdate, type AppUpdate } from './updateBridge';

type Phase = 'quiet' | 'available' | 'downloading' | 'ready' | 'installing' | 'download-error' | 'install-error';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const RETRY_INTERVAL = 15 * 60 * 1000;

export function UpdateFooter() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [phase, setPhase] = useState<Phase>('quiet');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (android || (!native && !demo)) return;
    let disposed = false;
    let checking = false;
    let nextCheck = 0;
    const check = async () => {
      if (disposed || checking || locked.current || document.hidden || Date.now() < nextCheck
          || !['quiet', 'available'].includes(phaseRef.current)) return;
      checking = true;
      nextCheck = Date.now() + CHECK_INTERVAL;
      try {
        const found = await checkAppUpdate();
        if (!disposed && !locked.current) {
          setUpdate(found);
          setPhase(found ? 'available' : 'quiet');
        }
      } catch {
        // An offline update check never changes the GPU server's readiness.
        nextCheck = Date.now() + RETRY_INTERVAL;
      } finally { checking = false; }
    };
    void check();
    const timer = setInterval(() => void check(), 60_000);
    const resume = () => void check();
    const online = () => { nextCheck = 0; void check(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', online);
    return () => {
      disposed = true; clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', online);
    };
  }, []);

  const download = useCallback(async () => {
    if (locked.current) return;
    locked.current = true;
    setPhase('downloading'); setProgress(null); setError('');
    const started = Date.now();
    try {
      await downloadAppUpdate(({ downloaded, total }) => {
        setProgress(total && total > 0 ? Math.min(100, Math.max(0, Math.round(downloaded / total * 100))) : null);
      });
      // Keep a tiny local update from flashing through the downloading state.
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 650 - (Date.now() - started))));
      setPhase('ready');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setPhase('download-error');
    } finally { locked.current = false; }
  }, []);

  const install = useCallback(async () => {
    if (locked.current) return;
    locked.current = true; setPhase('installing'); setError('');
    try {
      await installAppUpdate();
      if (!native) setPhase('ready');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setPhase('install-error');
    } finally { locked.current = false; }
  }, []);

  const ready = ['ready', 'installing', 'install-error'].includes(phase);
  const action = ready ? 'Restart' : phase === 'download-error' ? 'Retry' : 'Update';
  return <footer className="version-footer" aria-label="App version and updates">
    <span className="app-version">v{__APP_VERSION__}</span>
    {update && <div className="update-control">
      {phase === 'downloading' ? <div className={'update-download ' + (progress === null ? 'is-indeterminate' : '')}
        role="progressbar" aria-label="Downloading update" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={progress ?? undefined} aria-valuetext={progress === 100 ? 'Verifying update' : progress === null ? 'Downloading' : `${progress}% downloaded`}>
        <svg className="download-ring" viewBox="0 0 32 32" aria-hidden="true">
          <circle className="download-track" cx="16" cy="16" r="13" />
          <circle className="download-fill" cx="16" cy="16" r="13" pathLength="100" strokeDasharray={`${progress ?? 25} 100`} />
        </svg>
        <ArrowDownload16Regular aria-hidden="true" />
      </div> : <button type="button" className={`update-pill ${ready ? 'is-ready' : ''}`}
        onClick={() => void (ready ? install() : download())} disabled={phase === 'installing'}
        aria-label={ready ? `${action} to update to ${update.version}` : `${action} to ${update.version}`}
        aria-describedby={error ? 'update-error' : undefined}>
        {phase === 'installing' ? 'Restarting…' : action}
      </button>}
      {error && <p className="update-error" id="update-error" role="alert">{error}</p>}
    </div>}
    <span className="sr-only" role="status" aria-live="polite">{phase === 'available' ? `Shambu ${update?.version} is available.` : phase === 'ready' ? 'Update ready. Restart when you’re ready.' : phase === 'downloading' ? 'Downloading update.' : ''}</span>
  </footer>;
}
