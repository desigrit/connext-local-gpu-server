import { useState } from 'react';
const scenarios = [
  ['healthy', 'All ready'], ['offline', 'Ollama offline'], ['tailscale', 'Tailscale disconnected'],
  ['forwarding', 'Forwarding missing'], ['pairing', 'Pairing key rejected'], ['companion', 'Host companion offline'],
  ['cpu', 'CPU fallback'], ['empty', 'No models'], ['stale', 'Stale readings'], ['remote', 'Host not linked'],
];
export function PreviewControls({ onRecover, busy }: { onRecover: () => void; busy: boolean }) {
  const [recovered, setRecovered] = useState(false);
  const scenario = new URLSearchParams(location.search).get('demo') ?? 'healthy';
  function recover() {
    const next = new URL(location.href);
    next.searchParams.set('demo', 'healthy');
    next.searchParams.set('recovered', '1');
    history.replaceState(null, '', next);
    setRecovered(true); onRecover();
  }
  return <aside className="preview-notice" aria-label="Synthetic state preview">
    <div><strong>Design preview</strong><span>Sample readings only.</span></div>
    <label className="sr-only" htmlFor="preview-state">Preview state</label>
    <select id="preview-state" value={scenario} onChange={event => {
      sessionStorage.removeItem('shambu-demo-settings');
      location.search = '?demo=' + encodeURIComponent(event.target.value);
    }}>{scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    {scenario !== 'healthy' && <button className="text-action" onClick={recover} disabled={busy}>Simulate recovery</button>}
    {recovered && <span role="status">Recovery simulated.</span>}
  </aside>;
}
