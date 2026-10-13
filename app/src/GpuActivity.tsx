import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { GpuHistory, GpuMetrics } from './types';
import { Gpu } from 'lucide-react';
import { STALE_AFTER_MS } from './timing';
import { gpuBarVariants, type GpuBarVariant } from './gpuBarVariants';

const HOUR = 60 * 60 * 1000;
const usedMemory = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, useGrouping: false });
const totalMemory = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, useGrouping: false });
const memory = (mib: number | null | undefined, used = false) => mib == null ? 'N/A' : (used ? usedMemory : totalMemory).format(mib / 1024);
const fullTime = (time: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(time);

function tooltipTime(time: number) {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: new Date(time).getMinutes() ? '2-digit' : undefined, hour12: true }).formatToParts(time);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  const minutes = part('minute');
  return part('hour') + (minutes ? ':' + minutes : '') + ' ' + part('dayPeriod');
}

export function activityHours(history: GpuHistory | null | undefined, now: number) {
  const current = Math.floor(now / HOUR) * HOUR;
  const first = current - 48 * HOUR;
  const active = new Set(history?.source === 'ollama-gpu-estimate' ? history.activeHours : []);
  return Array.from({ length: 49 }, (_, index) => {
    const start = first + index * HOUR;
    return { start, active: active.has(start) };
  });
}

export default function GpuActivity({ history, gpuName, metrics, now, stale, variant = 'slender', compact = false }: { history?: GpuHistory | null; gpuName?: string | null; metrics?: GpuMetrics | null; now: number; stale: boolean; variant?: GpuBarVariant; compact?: boolean }) {
  const marks = gpuBarVariants.find(item => item.id === variant)?.marks ?? 1;
  const id = useId().replaceAll(':', '');
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState(48);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const hours = useMemo(() => activityHours(history, now), [history, now]);
  const selected = hovered ?? focused;
  const chosen = selected === null ? null : hours[selected];
  const earlier = stale || Boolean(history && now - history.sampledAtMs > STALE_AFTER_MS);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'ArrowRight' ? Math.min(hours.length - 1, index + 1) : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? hours.length - 1 : null;
    if (target !== null) { event.preventDefault(); setHovered(null); buttons.current[target]?.focus(); }
    if (event.key === 'Escape') { setHovered(null); setFocused(null); }
  }
  const deviceName = gpuName?.replace(/^NVIDIA\s+/i, 'Nvidia ').replace(/^(Quadro|GeForce|RTX|Tesla)\b/i, 'Nvidia $1');
  return <section className={'activity-strip bars-' + variant + (!compact ? ' activity-full' : '') + (earlier ? ' activity-old' : '')} aria-label="GPU usage over the last 48 hours">
    {!compact && <><div className="status-line activity-heading">
      <Gpu className="row-icon" size={19} strokeWidth={1.65} aria-hidden="true" /><h2 className="row-title">GPU usage</h2>
    </div>
      <div className="gpu-details">
        <p className="gpu-name">{deviceName || 'Details not linked'}</p>
        {(metrics?.devices ?? [null]).map(gpu => {
          const hasMemory = gpu?.memoryUsedMib != null || gpu?.memoryTotalMib != null;
          const numberColumns = {
            '--gpu-used-width': Math.max(4, memory(gpu?.memoryTotalMib, true).length) + 'ch',
          } as CSSProperties;
          return <div className="gpu-readings" key={gpu?.index ?? 'unavailable'}>
            {metrics && metrics.devices.length > 1 && <p className="gpu-index">GPU {gpu?.index}</p>}
            <dl className="gpu-metrics" style={numberColumns}>
              <div className="gpu-metric-row">
                <dt>GPU load{' '}</dt>
                <dd><span className="gpu-load-number">{gpu?.loadPercent ?? 'N/A'}</span><span className="gpu-load-unit">{gpu?.loadPercent == null ? '' : '%'}</span></dd>
              </div>
              <div className="gpu-metric-row">
                <dt>VRAM{' '}</dt>
                <dd><span className="gpu-memory-used">{memory(gpu?.memoryUsedMib, true)}</span><span className="gpu-memory-divider">{hasMemory ? '/' : ''}</span><span className="gpu-memory-total">{hasMemory ? memory(gpu?.memoryTotalMib) : ''}</span><span className="gpu-memory-unit">{hasMemory ? ' G' : ''}</span></dd>
              </div>
            </dl>
          </div>;
        })}
      </div>
    </>}
    <div className="activity-body">
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
    <div className="activity-times" aria-hidden="true"><span>48h</span><span>24h</span><span>Now</span></div>
    </div>
  </section>;
}
