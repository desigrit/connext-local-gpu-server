import GpuActivity from './GpuActivity';
import { gpuBarVariants } from './gpuBarVariants';
import type { GpuHistory } from './types';

const hour = 3600000;
const current = Math.floor(Date.now() / hour) * hour;
const now = current + hour / 2;
const active = [2, 3, 7, 8, 9, 12, 16, 17, 18, 21, 22];
const history: GpuHistory = {
  source: 'ollama-gpu-estimate', sampledAtMs: now, bursts: [],
  activeHours: active.map(index => current - (24 - index) * hour),
};

export default function GpuBarOptions() {
  return <main className="bar-options-page">
    <header className="bar-options-header"><div><h1>GPU usage</h1><p>Six directions. Same sample hours.</p></div><a href="?demo=healthy">Back to app</a></header>
    <div className="bar-options-grid">
      {gpuBarVariants.map((variant, index) => <article className="bar-option" key={variant.id} aria-labelledby={'option-' + variant.id}>
        <header><h2 id={'option-' + variant.id}>{index + 1} · {variant.name}</h2><p>{variant.detail}</p></header>
        <GpuActivity history={history} now={now} stale={false} variant={variant.id} compact />
        <a className="bar-option-link" href={'?demo=healthy&bars=' + variant.id}>Preview in app</a>
      </article>)}
    </div>
    <p className="bar-options-note">Hover or use the arrow keys to inspect an hour. Sample data only.</p>
  </main>;
}
