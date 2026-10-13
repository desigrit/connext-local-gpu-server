import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { GpuHistory } from './types';
import { Gpu } from 'lucide-react';
import { STALE_AFTER_MS } from './timing';
import { gpuBarVariants, type GpuBarVariant } from './gpuBarVariants';

const HOUR = 60 * 60 * 1000;
const fullTime = (time: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(time);

function tooltipTime(time: number) {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: new Date(time).getMinutes() ? '2-digit' : undefined, hour12: true }).formatToParts(time);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  const minutes = part('minute');
  return part('hour') + (minutes ? ':' + minutes : '') + ' ' + part('dayPeriod');
}

export function activityHours(history: GpuHistory | null | undefined, now: number) {
  const current = Math.floor(now / HOUR) * HOUR;
  const first = current - 24 * HOUR;
  const active = new Set(history?.source === 'ollama-gpu-estimate' ? history.activeHours : []);
  return Array.from({ length: 25 }, (_, index) => {
    const start = first + index * HOUR;
    return { start, active: active.has(start) };
  });
}

export default function GpuActivity({ history, gpuName, now, stale, variant = 'slender', compact = false }: { history?: GpuHistory | null; gpuName?: string | null; now: number; stale: boolean; variant?: GpuBarVariant; compact?: boolean }) {
  const marks = gpuBarVariants.find(item => item.id === variant)?.marks ?? 1;
  const id = useId().replaceAll(':', '');
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState(24);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const hours = useMemo(() => activityHours(history, now), [history, now]);
  const selected = hovered ?? focused;
  const chosen = selected === null ? null : hours[selected];
  const earlier = stale || Boolean(history && now - history.sampledAtMs > STALE_AFTER_MS);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'ArrowRight' ? Math.min(24, index + 1) : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? 24 : null;
    if (target !== null) { event.preventDefault(); setHovered(null); buttons.current[target]?.focus(); }
    if (event.key === 'Escape') { setHovered(null); setFocused(null); }
  }
  const deviceName = gpuName?.replace(/^NVIDIA\s+/i, 'Nvidia ').replace(/^(Quadro|GeForce|RTX|Tesla)\b/i, 'Nvidia $1');
  return <section className={'activity-strip bars-' + variant + (earlier ? ' activity-old' : '')} aria-label="GPU usage over the last 24 hours">
    {!compact && <div className="status-line activity-heading"><Gpu className="row-icon" size={19} strokeWidth={1.65} aria-hidden="true" /><h2 className="row-title">GPU usage</h2></div>}
    <div className="activity-body">
    {!compact && <p className="gpu-name">{deviceName ? 'Remote GPU: ' + deviceName : 'Remote GPU: Details not linked'}</p>}
    <p className="sr-only" id={id + '-help'}>Observed GPU activity while an Ollama model was in GPU memory. Other GPU work can contribute. Empty and unmonitored hours are Idle. Use left and right arrows to inspect hours.{earlier ? ' These are earlier readings.' : ''}</p>
    <div className="hour-track" onPointerLeave={() => setHovered(null)}>
      <div className="hour-columns" role="group" aria-label="Hourly GPU activity" aria-describedby={id + '-help'}>
        {hours.map((hour, index) => <button type="button" key={hour.start} ref={element => { buttons.current[index] = element; }} tabIndex={tabStop === index ? 0 : -1}
          className={'hour-column' + (hour.active ? ' hour-active' : '') + (selected === index ? ' hour-selected' : '')}
          aria-label={fullTime(hour.start) + ': ' + (hour.active ? 'Active' : 'Idle')}
          aria-describedby={selected === index ? id + '-tooltip' : undefined}
          onPointerEnter={() => setHovered(index)}
          onFocus={() => { setFocused(index); setTabStop(index); }}
          onBlur={() => setFocused(null)}
          onClick={() => { setFocused(index); setTabStop(index); }}
          onKeyDown={event => navigate(event, index)}>
          <span className="hour-marks" aria-hidden="true">{Array.from({ length: marks }, (_, mark) => <span className="hour-mark" key={mark} />)}</span>
        </button>)}
      </div>
      {chosen && <div className="hour-tooltip" id={id + '-tooltip'} role="tooltip" style={{ '--position': ((selected! + .5) / hours.length * 100) + '%' } as CSSProperties}>
        {tooltipTime(chosen.start)} · <strong>{chosen.active ? 'Active' : 'Idle'}</strong>
      </div>}
    </div>
    <div className="activity-times" aria-hidden="true"><span>24h</span><span>12h</span><span>Now</span></div>
    </div>
  </section>;
}
