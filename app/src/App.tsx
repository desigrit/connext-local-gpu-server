import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownUp, ArrowUpRight, Check as CheckIcon, ChevronDown, CircleHelp, Copy, Cpu, HardDrive, LoaderCircle, Monitor, Network, RefreshCw, Server, Settings2, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { android, checkReadiness, copyHostKey, copyText, defaultSettings, demo, loadSettings, native, saveSettings, validateSettings, type ConnectionIssue } from './bridge';
import { BRAND } from './brand';
import GpuActivity from './GpuActivity';
import type { Check, Mode, Settings, Snapshot } from './types';

const icons = { ollama: Server, tailscale: Network, forwarding: ArrowDownUp, gpu: Cpu, models: HardDrive };
const initialChecks: Check[] = [
  ['ollama', 'Ollama local URL'], ['tailscale', 'Tailscale'], ['forwarding', 'Forwarding'], ['gpu', 'GPU inference'], ['models', 'Model library'],
].map(([id, title]) => ({ id, title, state: 'unknown', label: 'Waiting', detail: 'Run a check to see this status.', help: null }));

function Mascot({ checking }: { checking: boolean; worried: boolean }) {
  return <img className={`mascot ${checking ? 'looking' : ''}`} src={BRAND.iconSrc} alt="Shikari Shambu" width="76" height="76" />;
}
function StatusRow({ check, stale }: { check: Check; stale: boolean }) {
  const Icon = icons[check.id as keyof typeof icons] ?? CircleHelp;
  const statusIcon = check.state === 'ok' ? <CheckIcon size={13} /> : ['error', 'warning'].includes(check.state) ? <TriangleAlert size={13} /> : <span className="state-dot" />;
  return <details className={`status-row state-${check.state} ${stale ? 'stale' : ''}`}>
    <summary>
      <Icon className="row-icon" size={19} strokeWidth={1.65} aria-hidden="true" />
      <span className="row-title">{check.title}</span>
      <span className="status-label">{statusIcon}{check.label}</span>
      <ChevronDown className="row-chevron" size={14} aria-hidden="true" />
    </summary>
    <div className="row-detail"><p>{check.detail}</p>{check.help && <p className="row-help">{check.help}</p>}</div>
  </details>;
}

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>(defaultSettings);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState<ConnectionIssue | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [auto, setAuto] = useState(true);
  const busyRef = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const endpointInput = useRef<HTMLInputElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);

  const runCheck = useCallback(async (connection: Settings) => {
    if (busyRef.current || validateSettings(connection) || (!native && !demo)) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await checkReadiness(connection);
      if (mounted.current) { setSnapshot(result); setNow(Date.now()); }
    } catch (failure) {
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
    if (!settings) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (auto && !document.hidden && !editing) void runCheck(settings);
    }, 30000);
    const visible = () => { setNow(Date.now()); if (!document.hidden && auto && !editing) void runCheck(settings); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [settings, auto, editing, runCheck]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (editing) endpointInput.current?.focus(); }, [editing]);

  const checks = snapshot?.checks ?? initialChecks;
  const gpuCheck = snapshot?.checks.find(check => check.id === 'gpu');
  const age = snapshot ? Math.max(0, Math.floor((now - snapshot.checkedAtMs) / 1000)) : 0;
  const stale = Boolean(snapshot && (age >= 65 || error));
  const disconnected = snapshot?.checks.find(check => check.id === 'ollama')?.state === 'error';
  const warnings = checks.filter(check => check.state === 'error' || check.state === 'warning');
  const unknown = checks.filter(check => check.state === 'unknown').length;
  const headline = !native && !demo ? 'A window into your server.' : !settings?.endpoint ? 'Meet your server.' : !snapshot ? (busy ? 'Taking a little look.' : 'Let’s check in.') : stale ? 'Time for a fresh look.' : disconnected ? 'Something is out of reach.' : warnings.length ? 'A little attention needed.' : 'Your server is within reach.';
  const description = !native && !demo ? 'Open the desktop or Android app to see live readiness.' : !settings?.endpoint ? 'Add its address below. We’ll take it from there.' : !snapshot ? 'A few quiet checks. No models loaded.' : stale ? 'These readings are from an earlier check.' : disconnected ? 'Start with Ollama. The details below can help.' : warnings.length ? 'The checks below point to what needs a look.' : 'Ollama is responding. Your GPU can stay undisturbed.';
  const checkedLabel = busy ? 'Checking now' : !snapshot ? 'Not checked yet' : age < 10 ? 'Checked just now' : age < 60 ? `Checked ${age}s ago` : `Checked ${Math.floor(age / 60)}m ago`;

  function closeSettings() { setEditing(false); setFormError(null); settingsButton.current?.focus(); }
  function chooseMode(mode: Mode) {
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
    setSaving(true); setFormError(null);
    try {
      const saved = await saveSettings(draft);
      setSnapshot(null); setSettings(saved); setDraft(saved); closeSettings();
    } catch (failure) { setFormError({ field: null, message: failure instanceof Error ? failure.message : String(failure) }); }
    finally { setSaving(false); }
  }
  async function copyEndpoint() {
    if (!settings?.endpoint) return;
    try {
      await copyText(settings.endpoint);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError('Could not copy the URL. You can select and copy the address below.'); }
  }

  async function copyPairingKey() {
    setFormError(null);
    try { await copyHostKey(); setKeyCopied(true); }
    catch (failure) { setFormError({ field: null, message: failure instanceof Error ? failure.message : String(failure) }); }
  }

  return <main className="app-shell">
    <header className="app-header">
      <span className="wordmark"><img className="brand-icon" src={BRAND.iconSrc} alt="" width="25" height="25" />{BRAND.name}</span>
      <button ref={settingsButton} className={`quiet-button connection-button ${editing ? 'selected' : ''}`} onClick={() => { setDraft(settings ?? defaultSettings); setEditing(value => !value); setFormError(null); }} aria-expanded={editing} aria-controls="connection-settings">
        <Settings2 size={16} aria-hidden="true" /><span>Connection</span>
      </button>
    </header>

    {demo && <aside className="preview-notice"><span>Design preview</span> Sample readings, not your server.</aside>}

    {editing && <section id="connection-settings" className="connection-panel" aria-labelledby="connection-heading">
      <div className="panel-heading"><h2 id="connection-heading">Find your server</h2><button className="icon-button" onClick={closeSettings} aria-label="Close connection settings"><X size={18} /></button></div>
      <form onSubmit={submit} noValidate>
        <fieldset className="mode-control"><legend className="sr-only">Server location</legend>
          {!android && <button type="button" aria-pressed={draft.mode === 'host'} onClick={() => chooseMode('host')}><Monitor size={16} />This computer</button>}
          <button type="button" aria-pressed={draft.mode === 'remote'} onClick={() => chooseMode('remote')}><ArrowUpRight size={16} />Remote server</button>
        </fieldset>
        <label htmlFor="server-name">Server name</label>
        <input aria-invalid={formError?.field === 'name'} aria-describedby={formError?.field === 'name' ? 'connection-error' : undefined} id="server-name" value={draft.name} maxLength={60} autoComplete="off" onChange={event => setDraft({ ...draft, name: event.target.value })} />
        <label htmlFor="server-url">Ollama URL</label>
        <input ref={endpointInput} id="server-url" type="url" value={draft.endpoint} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder={draft.mode === 'host' ? 'http://127.0.0.1:11434' : 'http://<your-server-ip>:11434'} onChange={event => setDraft({ ...draft, endpoint: event.target.value })} aria-describedby={formError?.field === 'endpoint' ? 'connection-error connection-hint' : 'connection-hint'} aria-invalid={formError?.field === 'endpoint'} />
        <p id="connection-hint" className="field-hint">{draft.mode === 'host' ? 'Use the local Ollama address on this computer.' : 'Use the GPU PC’s Tailscale IP. Keep Tailscale connected on both devices.'} Settings stay on this device.</p>
        {draft.mode === 'remote' ? <div className="host-link-fields">
          <label htmlFor="pairing-key">Host pairing key <span>(optional)</span></label>
          <input id="pairing-key" type="password" value={draft.diagnosticsKey} autoComplete="off" spellCheck={false} placeholder="Paste the key from your GPU PC" onChange={event => setDraft({ ...draft, diagnosticsKey: event.target.value })} aria-invalid={formError?.field === 'diagnosticsKey'} aria-describedby={formError?.field === 'diagnosticsKey' ? 'connection-error pairing-hint' : 'pairing-hint'} />
          <p id="pairing-hint" className="field-hint">Add this to see Tailscale and forwarding on the GPU PC itself. In Shambu on that PC, open Connection and copy its pairing key.</p>
          <details className="advanced-connection"><summary>Custom host status port</summary>
            <label htmlFor="diagnostics-url">Host status URL</label>
            <input aria-invalid={formError?.field === 'diagnosticsUrl'} aria-describedby={formError?.field === 'diagnosticsUrl' ? 'connection-error' : undefined} id="diagnostics-url" type="url" value={draft.diagnosticsUrl} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Automatic: same server, port 11435" onChange={event => setDraft({ ...draft, diagnosticsUrl: event.target.value })} />
          </details>
        </div> : <div className="host-sharing">
          <p>Share this PC’s checks with your other devices using the Shambu host companion.</p>
          <button type="button" className="quiet-button" onClick={copyPairingKey} disabled={!native}><Copy size={15} />{keyCopied ? 'Pairing key copied' : 'Copy pairing key'}</button>
          <span className="sr-only" role="status">{keyCopied ? 'Host pairing key copied to clipboard' : ''}</span>
        </div>}
        {formError && <p id="connection-error" className="form-error" role="alert">{formError.message}</p>}
        <button type="submit" className="primary-button save-button" disabled={saving || busy || (!native && !demo)}>{saving ? 'Saving…' : 'Save & check'}<ArrowUpRight size={16} /></button>
      </form>
    </section>}

    <section className="readiness" aria-labelledby="readiness-heading">
      <Mascot checking={busy} worried={Boolean(disconnected || warnings.length)} />
      <div className="readiness-message" role="status" aria-live="polite" aria-atomic="true">
        <h1 id="readiness-heading">{headline}</h1>
        <p>{description}</p>
      </div>
    </section>

    <section className="server-strip" aria-label="Selected server">
      <div className="server-identity"><Monitor size={18} strokeWidth={1.6} aria-hidden="true" /><div><h2>{settings?.name || 'My GPU server'}</h2><p className="endpoint">{settings?.endpoint || 'No address yet'}</p></div></div>
      <button className="icon-button" disabled={!settings?.endpoint} onClick={copyEndpoint} aria-label={copied ? 'URL copied' : 'Copy server URL'} title={copied ? 'Copied' : 'Copy server URL'}>{copied ? <CheckIcon size={17} /> : <Copy size={17} />}</button>
      <span className="sr-only" role="status">{copied ? 'Server URL copied' : ''}</span>
    </section>

    {error && <div className="error-banner" role="alert"><TriangleAlert size={18} aria-hidden="true" /><p>{error}</p></div>}

    <div className="readings-grid">
    <div className="readings-list">
    <section className="checklist" aria-label="Server readiness checks" aria-busy={busy}>
      <div className="list-heading"><h2>At a glance</h2><span>{snapshot ? snapshot.mode === 'host' ? 'On this computer' : 'From this device' : 'Read-only checks'}</span></div>
      {checks.filter(check => check.id !== 'gpu').map(check => <StatusRow key={check.id} check={check} stale={stale} />)}
    </section>

    {snapshot?.mode === 'remote' && snapshot.hostDetails !== 'linked' && <button className="host-link-prompt" onClick={() => { setDraft(settings ?? defaultSettings); setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
      <CircleHelp size={15} /><span>{snapshot.hostDetails === 'unauthorized' ? 'Host pairing key was not accepted' : snapshot.hostDetails === 'unreachable' ? 'Host details could not be reached' : 'Link host details for the full picture'}</span><ArrowUpRight size={14} />
    </button>}
    {gpuCheck && <details className={`allocation-note state-${gpuCheck.state}`}><summary><span>Model allocation</span><span className="allocation-status">{gpuCheck.label}</span><ChevronDown size={13} aria-hidden="true" /></summary><p>{gpuCheck.detail}</p>{gpuCheck.help && <p>{gpuCheck.help}</p>}</details>}
    </div>
    <GpuActivity history={snapshot?.gpuHistory} now={now} stale={stale} />
    </div>
    <div className="evidence-note"><ShieldCheck size={15} aria-hidden="true" /><p>{snapshot && unknown > 0 ? 'Some checks are unverified. Open a row for details.' : 'Checks never load a model or interrupt your work.'}</p></div>

    <footer className="app-footer">
      <div className="freshness"><span className={`freshness-dot ${busy ? 'busy' : ''} ${stale ? 'old' : ''}`} />{checkedLabel}<label className="auto-control"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} />Auto-check every 30s</label></div>
      {!native && !demo ? (import.meta.env.DEV && <a className="primary-button" href="?demo=healthy">Explore a preview<ArrowUpRight size={15} /></a>) : <button className="primary-button refresh-button" onClick={() => settings && void runCheck(settings)} disabled={busy || !settings?.endpoint || saving} aria-label={busy ? 'Checking server' : 'Check again'}>{busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{busy ? 'Checking…' : 'Check again'}</button>}
    </footer>
    <p className="sign-off">{BRAND.description}</p>
  </main>;
}
