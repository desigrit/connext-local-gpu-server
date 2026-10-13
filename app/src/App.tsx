import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check as CheckIcon, CircleHelp, Copy, Monitor, Settings2, TriangleAlert } from 'lucide-react';
import { ArrowClockwise20Regular } from '@fluentui/react-icons';
import { android, checkReadiness, copyText, defaultSettings, demo, loadSettings, native, saveSettings, validateSettings, type ConnectionIssue } from './bridge';
import GpuActivity from './GpuActivity';
import HostPairing from './HostPairing';
import StatusRow from './StatusRow';
import { getReadinessStatus } from './readiness';
import { gpuBarVariant } from './gpuBarVariants';
import { CHECK_INTERVAL_MS, STALE_AFTER_MS, checkedAge } from './timing';
import { PreviewControls } from './PreviewControls';
import { useWindowTheme } from './useWindowTheme';
import { UpdateFooter } from './UpdateFooter';
import type { Check, Mode, Settings, Snapshot } from './types';

const initialChecks: Check[] = [
  ['ollama', 'Ollama local URL'], ['tailscale', 'Tailscale'], ['forwarding', 'Forwarding'], ['gpu', 'GPU inference'], ['models', 'Model library'],
].map(([id, title]) => ({ id, title, state: 'unknown', label: 'Waiting', detail: 'Run a check to see this status.', help: null }));

export default function App() {
  const theme = useWindowTheme(!android);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>(defaultSettings);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState<ConnectionIssue | null>(null);
  const [copied, setCopied] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const lastCheck = useRef(0);
  const busyRef = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const endpointInput = useRef<HTMLInputElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);

  const runCheck = useCallback(async (connection: Settings) => {
    if (busyRef.current || validateSettings(connection) || (!native && !demo)) return;
    busyRef.current = true; lastCheck.current = Date.now(); setBusy(true); setError('');
    const minimum = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const [result] = await Promise.all([checkReadiness(connection), minimum]);
      if (mounted.current) { setSnapshot(result); setNow(Date.now()); }
    } catch (failure) {
      await minimum;
      if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadSettings().then(value => {
      if (!mounted.current) return;
      setSettings(value); setDraft(value);
      if (!value.endpoint) setEditing(true);
    }).catch(failure => {
      if (!mounted.current) return;
      setSettings(defaultSettings); setDraft(defaultSettings); setEditing(true);
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
  useEffect(() => { if (editing) endpointInput.current?.focus(); }, [editing]);

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
  const useRemoteName = draft.mode === 'remote' && draft.endpoint.trim().replace(/\/$/, '') === settings?.endpoint && draft.diagnosticsUrl === settings?.diagnosticsUrl && Boolean(remoteServerName);


  function openSettings() { setPairingCode(''); setDraft(settings ?? defaultSettings); setEditing(true); setFormError(null); }
  function closeSettings() { setPairingCode(''); setEditing(false); setFormError(null); settingsButton.current?.focus(); }
  function chooseMode(mode: Mode) {
    setPairingCode('');
    setDraft(previous => ({ ...previous, mode, endpoint: mode === 'host' ? 'http://127.0.0.1:11434' : previous.mode === 'host' ? '' : previous.endpoint }));
    setFormError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateSettings(draft);
    if (validation) {
      setFormError(validation);
      const fieldIds = { name: 'server-name', endpoint: 'server-url', diagnosticsKey: 'pairing-key', diagnosticsUrl: 'diagnostics-url' };
      const input = validation.field ? document.getElementById(fieldIds[validation.field]) : null;
      const disclosure = input?.closest('details');
      if (disclosure) disclosure.open = true;
      input?.focus();
      return;
    }
    if (pairingCode && !/^[A-HJ-NP-Z2-9]{8}$/.test(pairingCode)) {
      setFormError({ field: 'diagnosticsKey', message: 'Enter the 8-character code shown on your GPU PC.' });
      document.getElementById('pairing-key')?.focus(); return;
    }
    setSaving(true); setFormError(null);
    try {
      const saved = await saveSettings(draft, draft.mode === 'remote' ? pairingCode : '');
      setSnapshot(null); setSettings(saved); setDraft(saved); closeSettings();
    } catch (failure) { setFormError({ field: null, message: failure instanceof Error ? failure.message : String(failure) }); }
    finally { setSaving(false); }
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
    <main className="app-shell" data-theme={theme}>
    <header className="app-header">
      <div className="readiness-message">
        <h1 id="readiness-heading" aria-live="polite" aria-atomic="true">{headline}</h1>
        <div className="freshness">
          <span className={'connection-status ' + (readiness.tone === 'ok' ? 'is-connected' : readiness.tone === 'error' ? 'is-disconnected' : 'is-pending')}><span className="freshness-dot" aria-hidden="true" />{readiness.label}</span>
          <span aria-hidden="true">-</span><span aria-live="off">{checkedLabel}</span>
          {(!native && !demo) ? (import.meta.env.DEV && <a href="?demo=healthy">Preview</a>) : <button className="icon-button refresh-button" onClick={() => settings && void runCheck(settings)} disabled={busy || !settings?.endpoint || saving} aria-label={busy ? 'Checking server' : 'Refresh status'}><ArrowClockwise20Regular className={busy ? 'spin' : ''} aria-hidden="true" /></button>}
        </div>
      </div>
      <button ref={settingsButton} className={`icon-button connection-button ${editing ? 'selected' : ''}`} onClick={() => editing ? closeSettings() : openSettings()} aria-label="Settings" aria-expanded={editing} aria-controls="connection-settings">
        <Settings2 size={18} aria-hidden="true" />
      </button>
    </header>

    {demo && <PreviewControls onRecover={() => settings && void runCheck(settings)} busy={busy} />}

    {editing && <section id="connection-settings" className="connection-panel" aria-labelledby="connection-heading">
      <div className="panel-heading"><h2 id="connection-heading">Settings</h2></div>
      <p className="settings-purpose">Choose which GPU server this device checks.</p>
      <form onSubmit={submit} noValidate>
        <fieldset className="mode-control"><legend className="sr-only">Server location</legend>
          {!android && <button type="button" aria-pressed={draft.mode === 'host'} onClick={() => chooseMode('host')}><Monitor size={16} />This computer</button>}
          <button type="button" aria-pressed={draft.mode === 'remote'} onClick={() => chooseMode('remote')}><ArrowUpRight size={16} />Remote server</button>
        </fieldset>
        <label htmlFor="server-name">Server name</label>
        <input aria-invalid={formError?.field === 'name'} aria-describedby={formError?.field === 'name' ? 'connection-error' : undefined} id="server-name" value={useRemoteName ? remoteServerName : draft.name} readOnly={useRemoteName} maxLength={60} autoComplete="off" onChange={event => setDraft({ ...draft, name: event.target.value })} />
        <label htmlFor="server-url">Ollama URL</label>
        <input ref={endpointInput} id="server-url" type="url" value={draft.endpoint} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder={draft.mode === 'host' ? 'http://127.0.0.1:11434' : 'http://<your-server-ip>:11434'} onChange={event => setDraft({ ...draft, endpoint: event.target.value, diagnosticsKey: '' })} aria-describedby={formError?.field === 'endpoint' ? 'connection-error connection-hint' : 'connection-hint'} aria-invalid={formError?.field === 'endpoint'} />
        <p id="connection-hint" className="field-hint">{draft.mode === 'host' ? 'Use the local Ollama address on this computer.' : 'Use the GPU PC’s Tailscale IP. Keep Tailscale connected on both devices.'} Settings stay on this device.</p>
        {draft.mode === 'remote' ? <div className="host-link-fields">
          <div className="pairing-caption"><label htmlFor="pairing-key">Pairing code <span>(optional)</span></label>{draft.diagnosticsKey && <span className="paired-note">Paired <button type="button" className="text-action" onClick={() => setDraft({ ...draft, diagnosticsKey: '' })}>Unpair</button></span>}</div>
          <input id="pairing-key" className="code-input" type="text" value={pairingCode} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} placeholder={draft.diagnosticsKey ? 'Already paired' : 'ABCD 2345'} onChange={event => setPairingCode(event.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 8))} aria-invalid={formError?.field === 'diagnosticsKey'} aria-describedby={formError?.field === 'diagnosticsKey' ? 'connection-error pairing-hint' : 'pairing-hint'} />
          <p id="pairing-hint" className="field-hint">Find the code in Settings on your GPU PC. It links GPU history and the PC’s connection checks. Pair once per device.</p>
          <details className="advanced-connection"><summary>Custom host status port</summary>
            <label htmlFor="diagnostics-url">Host status URL</label>
            <input aria-invalid={formError?.field === 'diagnosticsUrl'} aria-describedby={formError?.field === 'diagnosticsUrl' ? 'connection-error' : undefined} id="diagnostics-url" type="url" value={draft.diagnosticsUrl} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Automatic: same server, port 11435" onChange={event => setDraft({ ...draft, diagnosticsUrl: event.target.value })} />
          </details>
        </div> : <HostPairing />}
        {formError && <p id="connection-error" className="form-error" role="alert">{formError.message}</p>}
        <div className="settings-actions">
          <button type="button" className="quiet-button cancel-button" onClick={closeSettings} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button save-button" disabled={saving || busy || (!native && !demo)}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </section>}

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
    <GpuActivity history={snapshot?.gpuHistory} gpuName={snapshot?.gpuName} now={now} stale={stale} variant={demo ? gpuBarVariant(new URLSearchParams(location.search).get("bars")) : "slender"} />
    </div>


  </main><UpdateFooter /></>;
}
