import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Monitor } from 'lucide-react';
import { android, demo, native, validateSettings, type ConnectionIssue } from './bridge';
import HostPairing from './HostPairing';
import type { Mode, Settings } from './types';

type Field = Exclude<ConnectionIssue['field'], null>;
const normalized = (value: Settings) => ({
  ...value, name: value.name.trim(), endpoint: value.endpoint.trim().replace(/\/$/, ''),
  diagnosticsKey: value.diagnosticsKey.trim(), diagnosticsUrl: value.diagnosticsUrl.trim().replace(/\/$/, ''),
});

export default function ConnectionPanel({ open, settings, serverName, needsPairing, saving, onCancel, onSave }: {
  open: boolean; settings: Settings; serverName?: string; needsPairing: boolean; saving: boolean;
  onCancel: () => void; onSave: (settings: Settings, code: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [pairingCode, setPairingCode] = useState('');
  const [changingPairing, setChangingPairing] = useState(needsPairing);
  const [touched, setTouched] = useState<Set<Field>>(new Set());
  const [failure, setFailure] = useState('');
  const endpointInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setDraft(settings); setPairingCode(''); setChangingPairing(needsPairing); setTouched(new Set()); setFailure('');
    endpointInput.current?.focus({ preventScroll: true });
  }, [open, settings]);
  useEffect(() => { if (changingPairing) codeInput.current?.focus({ preventScroll: true }); }, [changingPairing]);

  const codeIssue: ConnectionIssue | null = pairingCode && !/^[A-HJ-NP-Z2-9]{8}$/.test(pairingCode)
    ? { field: 'diagnosticsKey', message: 'Enter the 8-character code shown on your GPU PC.' } : null;
  const issue = validateSettings(draft) ?? codeIssue;
  const changed = JSON.stringify(normalized(draft)) !== JSON.stringify(normalized(settings)) || Boolean(pairingCode);
  const canSave = changed && !issue && !saving && (native || demo);
  const useRemoteName = draft.mode === 'remote' && Boolean(draft.diagnosticsKey) && Boolean(serverName)
    && normalized(draft).endpoint === settings.endpoint && draft.diagnosticsUrl === settings.diagnosticsUrl;
  const errorFor = (field: Field) => issue?.field === field && touched.has(field) ? issue.message : '';
  const description = (field: Field, hint?: string) => [errorFor(field) ? `settings-${field}-error` : '', hint].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: Field) => errorFor(field) && <p id={`settings-${field}-error`} className="field-error" role="alert">{errorFor(field)}</p>;
  function touch(field: Field) { setTouched(previous => new Set(previous).add(field)); }
  function update(patch: Partial<Settings>, field?: Field) {
    setDraft(previous => ({ ...previous, ...patch })); setFailure('');
    if (field) touch(field);
  }
  function chooseMode(mode: Mode) {
    if (mode === draft.mode) return;
    setPairingCode(''); setChangingPairing(false); setTouched(new Set()); setFailure('');
    setDraft(previous => ({ ...previous, mode, endpoint: mode === 'host' ? 'http://127.0.0.1:11434' : previous.mode === 'host' ? '' : previous.endpoint }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) { if (issue?.field) touch(issue.field); return; }
    setFailure('');
    try { await onSave(draft, draft.mode === 'remote' ? pairingCode : ''); }
    catch (error) { setFailure(error instanceof Error ? error.message : String(error)); }
  }
  return <section className="connection-panel" aria-labelledby="connection-heading" onKeyDown={event => {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onCancel(); }
  }}>
    <div className="settings-content">
      <div className="panel-heading">
        <button type="button" className="icon-button settings-back" aria-label="Back" onClick={onCancel} disabled={saving}><ArrowLeft size={18} aria-hidden="true" /></button>
        <h2 id="connection-heading">Settings</h2>
      </div>
      <form onSubmit={submit} noValidate>
        <fieldset className="mode-control" disabled={saving}><legend className="sr-only">Server location</legend>
          {!android && <button type="button" aria-pressed={draft.mode === 'host'} onClick={() => chooseMode('host')}><Monitor size={16} aria-hidden="true" />This computer</button>}
          <button type="button" aria-pressed={draft.mode === 'remote'} onClick={() => chooseMode('remote')}><ArrowUpRight size={16} aria-hidden="true" />Remote server</button>
        </fieldset>
        <div className="settings-field">
          <label htmlFor="server-name">Server name</label>
          <input id="server-name" value={useRemoteName ? serverName : draft.name} readOnly={useRemoteName} disabled={saving} maxLength={60} autoComplete="off" onChange={event => update({ name: event.target.value }, 'name')} onBlur={() => touch('name')} aria-invalid={Boolean(errorFor('name'))} aria-describedby={description('name')} />
          {fieldError('name')}
        </div>
        <div className="settings-field">
          <label htmlFor="server-url">Ollama URL</label>
          <input ref={endpointInput} id="server-url" type="url" value={draft.endpoint} disabled={saving} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder={draft.mode === 'host' ? 'http://127.0.0.1:11434' : 'http://<your-server-ip>:11434'} onChange={event => update({ endpoint: event.target.value, diagnosticsKey: '' }, 'endpoint')} onBlur={() => touch('endpoint')} aria-invalid={Boolean(errorFor('endpoint'))} aria-describedby={description('endpoint', draft.mode === 'remote' ? 'connection-hint' : undefined)} />
          {fieldError('endpoint')}
          {draft.mode === 'remote' && <p id="connection-hint" className="field-hint">Use your GPU PC’s Tailscale address.</p>}
        </div>
        {draft.mode === 'remote' ? <>
          <div className="host-link-fields">
            {draft.diagnosticsKey && !changingPairing ? <div className="paired-summary">
              <div><span className="pairing-state"><span className="state-dot" aria-hidden="true" />Paired</span><p>{serverName || draft.name}</p></div>
              <div className="paired-actions">
                <button type="button" className="text-action" disabled={saving} onClick={() => setChangingPairing(true)}>Change</button>
                <button type="button" className="text-action" disabled={saving} onClick={() => { update({ diagnosticsKey: '' }); setPairingCode(''); }}>Unpair</button>
              </div>
            </div> : <div className="settings-field">
              <label htmlFor="pairing-key">Pairing code <span>(optional)</span></label>
              <input ref={codeInput} id="pairing-key" className="code-input" type="text" value={pairingCode} disabled={saving} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} placeholder="ABCD 2345" onChange={event => { setPairingCode(event.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 8)); touch('diagnosticsKey'); setFailure(''); }} onBlur={() => touch('diagnosticsKey')} aria-invalid={Boolean(errorFor('diagnosticsKey'))} aria-describedby={description('diagnosticsKey', 'pairing-hint')} />
              {fieldError('diagnosticsKey')}
              <p id="pairing-hint" className="field-hint">Find this in Settings on your GPU PC.</p>
            </div>}
          </div>
          <details className="advanced-connection"><summary>Custom host status port</summary>
            <div className="settings-field">
              <label htmlFor="diagnostics-url">Host status URL</label>
              <input id="diagnostics-url" type="url" value={draft.diagnosticsUrl} disabled={saving} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Automatic: same server, port 11435" onChange={event => update({ diagnosticsUrl: event.target.value }, 'diagnosticsUrl')} onBlur={() => touch('diagnosticsUrl')} aria-invalid={Boolean(errorFor('diagnosticsUrl'))} aria-describedby={description('diagnosticsUrl')} />
              {fieldError('diagnosticsUrl')}
            </div>
          </details>
        </> : <HostPairing active={open} />}
        {failure && <p className="form-error" role="alert">{failure}</p>}
        <div className="settings-actions">
          <button type="button" className="quiet-button cancel-button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button save-button" disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  </section>;
}
