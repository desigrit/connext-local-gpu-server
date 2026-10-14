import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check as CheckIcon, CircleHelp, Copy, Monitor, TriangleAlert } from 'lucide-react';
import { ArrowClockwise20Regular } from '@fluentui/react-icons';
import { android, checkReadiness, copyText, defaultSettings, demo, loadSettings, native, saveSettings, validateSettings } from './bridge';
import GpuActivity from './GpuActivity';
import Collapsible from './Collapsible';
import ConnectionPanel from './ConnectionPanel';
import StatusRow from './StatusRow';
import { getReadinessStatus } from './readiness';
import { gpuBarVariant } from './gpuBarVariants';
import { CHECK_INTERVAL_MS, STALE_AFTER_MS, checkedAge } from './timing';
import { PreviewControls } from './PreviewControls';
import { useWindowTheme } from './useWindowTheme';
import { useGpuMetrics } from './useGpuMetrics';
import { useAnchoredLayout } from './useAnchoredLayout';
import { useClickFeedback } from './useClickFeedback';
import { UpdateFooter } from './UpdateFooter';
import SettingsIcon from './SettingsIcon';
import type { Check, Settings, Snapshot } from './types';

const initialChecks: Check[] = [
  ['ollama', 'Ollama local URL'], ['tailscale', 'Tailscale'], ['forwarding', 'Forwarding'], ['gpu', 'GPU inference'], ['models', 'Model library'],
].map(([id, title]) => ({ id, title, state: 'unknown', label: 'Waiting', detail: 'Run a check to see this status.', help: null }));

export default function App() {
  const shell = useAnchoredLayout();
  useClickFeedback();
  const theme = useWindowTheme(!android);
  const [settings, setSettings] = useState<Settings | null>(null);
  const gpuMetrics = useGpuMetrics(settings);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lastCheck = useRef(0);
  const busyRef = useRef(false);
  const checkVersion = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const settingsButton = useRef<HTMLButtonElement>(null);

  const runCheck = useCallback(async (connection: Settings) => {
    if (busyRef.current || validateSettings(connection) || (!native && !demo)) return;
    const version = ++checkVersion.current;
    busyRef.current = true; lastCheck.current = Date.now(); setBusy(true); setError('');
    const minimum = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const [result] = await Promise.all([checkReadiness(connection), minimum]);
      if (mounted.current && version === checkVersion.current) { setSnapshot(result); setNow(Date.now()); }
    } catch (failure) {
      await minimum;
      if (mounted.current && version === checkVersion.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (version === checkVersion.current) {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadSettings().then(value => {
      if (!mounted.current) return;
      setSettings(value);
      if (!value.endpoint) setEditing(true);
    }).catch(failure => {
      if (!mounted.current) return;
      setSettings(defaultSettings); setEditing(true);
      setError(String(failure));
    });
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);

  useEffect(() => {
    if (!settings) return;
    void runCheck(settings);
  }, [settings, runCheck]);

  useEffect(() => {
    if (!settings || busy) return;
    const refreshIfDue = () => {
      setNow(Date.now());
      if (!document.hidden && !editing && Date.now() - lastCheck.current >= CHECK_INTERVAL_MS) void runCheck(settings);
    };
    const timer = setTimeout(refreshIfDue, Math.max(0, CHECK_INTERVAL_MS - (Date.now() - lastCheck.current)));
    document.addEventListener('visibilitychange', refreshIfDue);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refreshIfDue); };
  }, [settings, busy, editing, runCheck]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const checks = snapshot?.checks ?? initialChecks;
  const gpuCheck = snapshot?.checks.find(check => check.id === 'gpu');
  const stale = Boolean(snapshot && (now - snapshot.checkedAtMs >= STALE_AFTER_MS || error));
  const disconnected = snapshot?.checks.find(check => check.id === 'ollama')?.state === 'error';
  const readiness = getReadinessStatus(snapshot, { stale, checking: busy });
  const headline = !native && !demo ? 'A window into your server.' : !settings?.endpoint ? 'Meet your server.' : !snapshot ? (busy ? 'Taking a little look.' : 'Let’s check in.') : stale ? 'Time for a fresh look.' : disconnected ? 'Something is out of reach.' : (readiness.tone !== 'ok') ? 'A little attention needed.' : 'Your server is within reach.';
  const checkedLabel = busy ? 'Checking' : !snapshot ? 'Not checked' : checkedAge(snapshot.checkedAtMs, now);
  const externalEndpoint = settings?.mode === 'remote' ? settings.endpoint : snapshot?.externalEndpoint;
  const remoteServerName = settings?.mode === 'remote' && snapshot?.mode === 'remote' && snapshot.endpoint === settings.endpoint
    ? snapshot.serverName?.trim() : undefined;
  function openSettings() { setEditing(true); }
  function dismissSettings() { setEditing(false); settingsButton.current?.focus({ preventScroll: true }); }
  function closeSettings() { if (!saving) dismissSettings(); }
  async function saveConnection(connection: Settings, code: string) {
    setSaving(true);
    try {
      const saved = await saveSettings(connection, code);
      checkVersion.current++; busyRef.current = false; setBusy(false);
      setSnapshot(null); setSettings(saved); dismissSettings();
    } finally { setSaving(false); }
    requestAnimationFrame(() => settingsButton.current?.focus({ preventScroll: true }));
  }
  async function copyEndpoint() {
    if (!externalEndpoint) return;
    try {
      await copyText(externalEndpoint);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError('Could not copy the URL. You can select and copy the address below.'); }
  }

  return <>
    {theme === 'vines' && <div className="vine-frame" aria-hidden="true" />}
    <main ref={shell} className="app-shell" data-theme={theme}>
    <header className="app-header">
      <div className="readiness-message">
        <h1 id="readiness-heading" aria-live="polite" aria-atomic="true">{headline}</h1>
        <div className="freshness">
          <span className={'connection-status ' + (readiness.tone === 'ok' ? 'is-connected' : readiness.tone === 'error' ? 'is-disconnected' : 'is-pending')}><span className="freshness-dot" aria-hidden="true" />{readiness.label}</span>
          <span aria-hidden="true">-</span><span aria-live="off">{checkedLabel}</span>
          {(!native && !demo) ? (import.meta.env.DEV && <a href="?demo=healthy">Preview</a>) : <button className="icon-button refresh-button" onClick={() => settings && void runCheck(settings)} disabled={busy || !settings?.endpoint || saving} aria-label={busy ? 'Checking server' : 'Refresh status'}><ArrowClockwise20Regular className={busy ? 'spin' : ''} aria-hidden="true" /></button>}
        </div>
      </div>
      <button ref={settingsButton} className={`icon-button connection-button ${editing ? 'selected' : ''}`} onClick={() => editing ? closeSettings() : openSettings()} disabled={saving} aria-label="Settings" aria-expanded={editing} aria-controls="connection-settings">
        <SettingsIcon open={editing} />
      </button>
    </header>

    {demo && <PreviewControls onRecover={() => settings && void runCheck(settings)} busy={busy} />}

    <Collapsible id="connection-settings" open={editing}>
      <ConnectionPanel open={editing} settings={settings ?? defaultSettings} serverName={remoteServerName ?? undefined}
        needsPairing={snapshot?.hostDetails === 'unauthorized'} saving={saving} onCancel={closeSettings} onSave={saveConnection} />
    </Collapsible>

    <section className="server-strip" aria-label="Selected server">
      <div className="server-identity"><Monitor size={18} strokeWidth={1.6} aria-hidden="true" /><div><h2>{remoteServerName || settings?.name || 'My GPU server'}</h2><p className="endpoint">{externalEndpoint || (settings?.mode === 'host' ? 'Tailscale URL unavailable' : 'No address yet')}</p></div></div>
      <button className="icon-button" disabled={!externalEndpoint} onClick={copyEndpoint} aria-label={copied ? 'URL copied' : 'Copy server URL'} title={copied ? 'Copied' : 'Copy server URL'}>{copied ? <CheckIcon size={17} /> : <Copy size={17} />}</button>
      <span className="sr-only" role="status">{copied ? 'Server URL copied' : ''}</span>
    </section>

    {error && <div className="error-banner" role="alert"><TriangleAlert size={18} aria-hidden="true" /><div><p>{error}</p><button className="text-action" onClick={() => settings && void runCheck(settings)} disabled={busy}>Try again</button></div></div>}

    <div className="readings-grid">
    <div className="readings-list">
    <section className="checklist" aria-label="Server readiness checks" aria-busy={busy}>
      {checks.filter(check => check.id !== 'gpu').map(check => <StatusRow key={check.id} check={check} stale={stale} models={snapshot?.installedModels ?? []} mode={settings?.mode ?? 'host'} busy={busy} onRetry={() => settings && void runCheck(settings)} onSettings={openSettings} />)}
    </section>

    {snapshot?.mode === 'remote' && snapshot.hostDetails !== 'linked' && <button className="host-link-prompt" onClick={() => { openSettings(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
      <CircleHelp size={15} /><span>{snapshot.hostDetails === 'unauthorized' ? 'Pair this device again' : snapshot.hostDetails === 'unreachable' ? 'Check the host companion connection' : 'Link host details'}</span><ArrowUpRight size={14} />
    </button>}
    {gpuCheck && ['warning', 'error'].includes(gpuCheck.state) && <div className={'gpu-warning state-' + gpuCheck.state}><strong>{gpuCheck.label}</strong><p>{gpuCheck.help || gpuCheck.detail}</p></div>}
    </div>
    <GpuActivity history={snapshot?.gpuHistory} gpuName={snapshot?.gpuName} metrics={gpuMetrics} now={now} stale={stale} variant={demo ? gpuBarVariant(new URLSearchParams(location.search).get("bars")) : "slender"} />
    </div>


  </main><UpdateFooter /></>;
}
