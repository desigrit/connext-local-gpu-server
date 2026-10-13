import { useEffect, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, ChevronDown, CircleHelp, HardDrive, Download } from 'lucide-react';
import { android, companionAvailability, installCompanionApp, openCompanionApp, type Availability, type CompanionApp } from './bridge';
import DelayedTooltip from './DelayedTooltip';
import ollamaIcon from './assets/brands/ollama.svg';
import tailscaleIcon from './assets/brands/tailscale.png';
import qwenIcon from './assets/brands/qwen.png';
import type { Check, InstalledModel, Mode } from './types';

const icons = { forwarding: ArrowDownUp, models: HardDrive };
const appIcons = { ollama: ollamaIcon, tailscale: tailscaleIcon };
const modelSize = (bytes: number) => bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' GB' : Math.round(bytes / 1e6) + ' MB';
const descriptions: Record<string, string> = {
  ollama: 'Ollama runs the AI models on your GPU PC. This check asks whether its server responds. The arrow opens Ollama on this device.',
  tailscale: 'Tailscale connects your devices privately, at home or away. This row checks the GPU PC. The arrow opens Tailscale on this device.',
  forwarding: 'The private route from your other devices to Ollama on the GPU PC. Tailscale passes the connection to Ollama’s local address.',
  models: 'Models downloaded on your GPU PC and ready to use. Open the list to see their names and sizes.',
};

export default function StatusRow({ check, stale, models, mode, busy, onRetry, onSettings }: {
  check: Check; stale: boolean; models: InstalledModel[]; mode: Mode; busy: boolean;
  onRetry: () => void; onSettings: () => void;
}) {
  const [launchMessage, setLaunchMessage] = useState('');
  const [launchFailed, setLaunchFailed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [available, setAvailable] = useState<Availability>('unknown');
  const app: CompanionApp | null = check.id === 'ollama' || check.id === 'tailscale' ? check.id : null;
  const Icon = icons[check.id as keyof typeof icons] ?? CircleHelp;
  const canLaunch = app && !(android && app === 'ollama');
  const canInstall = app && available !== 'unsupported' && (available === 'missing' || launchFailed) && (app === 'tailscale' || mode === 'host');
  const launchName = app === 'ollama' ? 'Ollama' : 'Tailscale';
  const needsAttention = check.state === 'error' || check.state === 'warning';
  useEffect(() => {
    if (!app) return;
    let active = true;
    const inspect = () => { void companionAvailability(app).then(value => { if (active) setAvailable(value); }).catch(() => {}); };
    inspect(); window.addEventListener('focus', inspect);
    return () => { active = false; window.removeEventListener('focus', inspect); };
  }, [app, busy]);
  useEffect(() => {
    if (!launchMessage || launchFailed) return;
    const timer = setTimeout(() => setLaunchMessage(''), 4500);
    return () => clearTimeout(timer);
  }, [launchMessage, launchFailed]);
  async function launch(target: CompanionApp) {
    if (launching || installing) return;
    setLaunching(true); setLaunchFailed(false); setLaunchMessage('');
    try { setLaunchMessage(await openCompanionApp(target)); }
    catch (error) { setLaunchFailed(true); setLaunchMessage(String(error).replace(/^Error: /, '')); }
    finally { setLaunching(false); }
  }
  async function install() {
    if (!app || installing) return;
    setInstalling(true); setLaunchFailed(false); setLaunchMessage('');
    try { setLaunchMessage(await installCompanionApp(app)); setAvailable(await companionAvailability(app)); }
    catch (error) { setLaunchFailed(true); setLaunchMessage(String(error).replace(/^Error: /, '')); }
    finally { setInstalling(false); }
  }
  const icon = app ? <img className={'row-icon brand-icon brand-' + app} src={appIcons[app]} alt="" /> : <Icon className="row-icon" size={19} strokeWidth={1.65} aria-hidden="true" />;
  const label = check.label === 'Connected' || check.label === 'Reachable' ? 'Active' : check.label;
  const content = <>
    <DelayedTooltip text={descriptions[check.id] ?? check.detail}>
      {canLaunch ? <button className="row-app-link" onClick={() => void launch(app)} disabled={launching || installing} aria-label={'Open ' + launchName + ' on this device'}>{icon}<span>{check.title}</span><ArrowUpRight size={13} aria-hidden="true" /></button>
        : <span className="row-label-help" tabIndex={0}>{icon}<span className="row-title">{check.title}</span></span>}
    </DelayedTooltip>
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
        {check.id === 'models' && mode === 'host' && !android && <button className="text-action" onClick={() => void launch('ollama')}>Open Ollama<ArrowUpRight size={12} /></button>}
      </div>
    </div>}
    {canInstall && <div className="install-help"><p>{available === 'missing' ? launchName + ' wasn’t found on this device.' : 'Need to install ' + launchName + '?'}</p><button className="text-action" disabled={installing} onClick={() => void install()}><Download size={13} />{installing ? 'Installing…' : 'Install ' + launchName}</button><p>{android ? 'Opens Google Play.' : /Windows/i.test(navigator.userAgent) ? 'Opens the official installer on this PC.' : 'Opens the official download for this device.'}</p></div>}
    {launchMessage && <p className={'launch-feedback' + (launchFailed ? ' launch-failed' : '')} role={launchFailed ? 'alert' : 'status'}>{launchMessage}</p>}
  </div>;
}
