import { useState } from 'react';
import { ArrowDownUp, ArrowUpRight, ChevronDown, CircleHelp, HardDrive } from 'lucide-react';
import { android, openCompanionApp } from './bridge';
import ollamaIcon from './assets/brands/ollama.svg';
import tailscaleIcon from './assets/brands/tailscale.svg';
import qwenIcon from './assets/brands/qwen.png';
import type { Check, InstalledModel, Mode } from './types';

const icons = { forwarding: ArrowDownUp, models: HardDrive };
const appIcons = { ollama: ollamaIcon, tailscale: tailscaleIcon };
const modelSize = (bytes: number) => bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' GB' : Math.round(bytes / 1e6) + ' MB';

export default function StatusRow({ check, stale, models, mode, busy, onRetry, onSettings }: {
  check: Check; stale: boolean; models: InstalledModel[]; mode: Mode; busy: boolean;
  onRetry: () => void; onSettings: () => void;
}) {
  const [launchMessage, setLaunchMessage] = useState('');
  const [launchFailed, setLaunchFailed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const app = check.id === 'ollama' || check.id === 'tailscale' ? check.id : null;
  const Icon = icons[check.id as keyof typeof icons] ?? CircleHelp;
  const canLaunch = app && !(android && app === 'ollama');
  const launchName = app === 'ollama' ? 'Ollama' : 'Tailscale';
  const needsAttention = check.state === 'error' || check.state === 'warning';
  async function launch() {
    if (!app || launching) return;
    setLaunching(true); setLaunchFailed(false); setLaunchMessage('');
    try { setLaunchMessage(await openCompanionApp(app)); }
    catch (error) { setLaunchFailed(true); setLaunchMessage(error instanceof Error ? error.message : String(error)); }
    finally { setLaunching(false); }
  }
  const icon = app ? <img className={'row-icon brand-icon brand-' + app} src={appIcons[app]} alt="" /> : <Icon className="row-icon" size={19} strokeWidth={1.65} aria-hidden="true" />;
  const label = check.label === 'Connected' || check.label === 'Reachable' ? 'Active' : check.label;
  const content = <>
    {canLaunch ? <button className="row-app-link" onClick={() => void launch()} disabled={launching} aria-label={'Open ' + launchName + ' on this device'}>
      {icon}<span>{check.title}</span><ArrowUpRight size={13} aria-hidden="true" />
      <span className="app-link-hint" role="tooltip">Open {launchName} on this device</span>
    </button> : <>{icon}<span className="row-title">{check.title}</span></>}
    <span className="status-label"><span className="state-dot" aria-hidden="true" />{label}</span>
  </>;
  const className = 'status-row state-' + check.state + (stale ? ' stale' : '');
  if (check.id === 'models' && models.length) return <details className={className}>
    <summary className="status-line">{content}<ChevronDown className="row-chevron" size={14} aria-hidden="true" /></summary>
    <ul className="model-list" aria-label="Installed models">{models.map(model => <li key={model.name}>
      {/^(?:[^/]+\/)?qwen/i.test(model.name) ? <img src={qwenIcon} className="model-icon" alt="Qwen" /> : <HardDrive className="model-icon" size={17} aria-hidden="true" />}
      <span className="model-name">{model.name}</span><span className="model-size">{modelSize(model.size)}</span>
    </li>)}</ul>
  </details>;
  return <div className={className}>
    <div className="status-line">{content}<span className="row-chevron-space" /></div>
    {needsAttention && <div className="row-detail">
      <p>{check.detail}</p>{check.help && <p className="row-help">{check.help}</p>}
      <div className="recovery-actions">
        <button className="text-action" onClick={onRetry} disabled={busy}>Check again</button>
        {check.id === 'ollama' && <button className="text-action" onClick={onSettings}>Edit address</button>}
        {check.id === 'models' && mode === 'host' && !android && <button className="text-action" onClick={() => {
          setLaunchMessage(''); setLaunchFailed(false);
          void openCompanionApp('ollama').then(setLaunchMessage).catch(error => { setLaunchFailed(true); setLaunchMessage(String(error)); });
        }}>Open Ollama<ArrowUpRight size={12} /></button>}
      </div>
    </div>}
    {launchMessage && <p className={'launch-feedback' + (launchFailed ? ' launch-failed' : '')} role={launchFailed ? 'alert' : 'status'}>{launchMessage}</p>}
  </div>;
}
