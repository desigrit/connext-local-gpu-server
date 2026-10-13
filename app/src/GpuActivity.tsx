import { useId, useMemo, useState } from 'react';
import { CircleHelp, Leaf } from 'lucide-react';
import type { GpuHistory } from './types';

const HOUR = 60 * 60 * 1000;
const shortTime = (time: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: new Date(time).getMinutes() ? '2-digit' : undefined }).format(time);
const fullTime = (time: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(time);

export function activityHours(history: GpuHistory | null | undefined, now: number) {
  const current = new Date(now);
  current.setMinutes(0, 0, 0);
  const first = current.getTime() - 24 * HOUR;
  const hours = Array.from({ length: 25 }, (_, index) => ({ start: first + index * HOUR, count: 0 }));
  for (const time of history?.bursts ?? []) {
    if (!Number.isFinite(time) || time > now || time < now - 24 * HOUR) continue;
    const index = Math.floor((time - first) / HOUR);
    if (index >= 0 && index < hours.length) hours[index].count++;
  }
  return hours;
}

export default function GpuActivity({ history, now, stale }: { history?: GpuHistory | null; now: number; stale: boolean }) {
  const id = useId().replaceAll(':', '');
  const [selected, setSelected] = useState(24);
  const hours = useMemo(() => activityHours(history, now), [history, now]);
  const total = hours.reduce((sum, hour) => sum + hour.count, 0);
  const chosen = hours[selected];
  const startX = 20;
  const stepX = 560 / 24;
  const position = (index: number) => startX + stepX * index;
  const earlier = stale || Boolean(history && now - history.sampledAtMs > 65000);
  const description = hours.map(hour => `${fullTime(hour.start)}: ${hour.count ? `${hour.count} ${hour.count === 1 ? 'burst' : 'bursts'}` : 'Idle'}`).join('; ');
  return <section className={`activity-panel ${earlier ? 'activity-old' : ''}`} aria-labelledby={`${id}-heading`}>
    <div className="activity-heading"><h2 id={`${id}-heading`}><Leaf size={15} aria-hidden="true" />GPU activity</h2><span>{total} {total === 1 ? 'burst' : 'bursts'}</span><details className="activity-explainer"><summary aria-label="About GPU burst counts"><CircleHelp size={16} /></summary><p>A burst begins at 5% GPU use after 60 quiet seconds and counts toward the hour it started. Shambu samples every 5 seconds, so very short bursts can be missed. This includes work outside Ollama. Empty hours start as Idle. Busier hours gather more fireflies, with up to 12 shown; select an hour for its full count.</p></details></div>
    <svg className="firefly-chart" viewBox="0 0 600 184" role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`}>
      <title id={`${id}-chart-title`}>GPU bursts recorded in the last 24 hours</title>
      <desc id={`${id}-chart-description`}>{description}</desc>
      <defs><radialGradient id={`${id}-glow`}><stop offset="0" stopColor="#e4efa3" stopOpacity=".55" /><stop offset="1" stopColor="#e4efa3" stopOpacity="0" /></radialGradient></defs>
      <g className="jungle-understory" fill="#6d9980" opacity=".16" aria-hidden="true">
        <path d="M0 218C35 171 33 138 22 116C57 137 65 185 31 218ZM0 212C51 176 78 177 103 190C70 207 37 220 0 224ZM600 218C558 175 568 141 580 126C551 138 534 180 567 218ZM600 216C552 191 520 188 494 205C533 220 566 227 600 225Z" />
      </g>
      <path d="M16 169C92 151 152 180 224 168S349 156 423 169S522 176 586 162" fill="none" stroke="#74957a" strokeWidth="1.4" opacity=".55" aria-hidden="true" />
      {hours.map((hour, index) => {
        const x = position(index);
        const active = hour.count > 0;
        return <g key={hour.start} aria-hidden="true">
          {selected === index && <ellipse cx={x} cy="130" rx="17" ry="58" fill="#e4efa3" opacity=".055" />}
          {Array.from({ length: Math.min(hour.count, 12) }, (_, light) => {
            const y = 143 - light * 9 + Math.sin(index * 2 + light) * 4;
            const flyX = x + Math.sin(light * 2.4 + index) * 6;
            return <g key={light}><circle cx={flyX} cy={y} r="10" fill={`url(#${id}-glow)`} /><path d={`M${flyX - 1} ${y - 2}q-7 -7 -5 -1M${flyX + 1} ${y - 2}q7 -7 5 -1`} stroke="#cfdfa1" strokeWidth="1" opacity=".5" fill="none" /><circle cx={flyX} cy={y} r="2.5" fill="#e4efa3" /></g>;
          })}
          <circle cx={x} cy="170" r={selected === index ? 4 : 2} fill={selected === index ? '#e4efa3' : active ? '#88aa79' : '#436454'} />
        </g>;
      })}
    </svg>
    <div className="activity-axis" aria-hidden="true"><span>24h ago</span>{[6, 12, 18].map(index => <span key={index}>{shortTime(hours[index].start)}</span>)}<span>Now</span></div>
    <label className="sr-only" htmlFor={`${id}-hour`}>Inspect an hour of GPU activity</label>
    <input id={`${id}-hour`} className="hour-selector" type="range" min="0" max="24" step="1" value={selected} aria-valuetext={`${fullTime(chosen.start)}, ${chosen.count ? `${chosen.count} ${chosen.count === 1 ? 'burst' : 'bursts'}` : 'Idle'}`} onChange={event => setSelected(Number(event.target.value))} />
    <div className="hour-reading" aria-live="polite"><span>{shortTime(Math.max(chosen.start, now - 24 * HOUR))}{selected === 24 ? ' to now' : ` to ${shortTime(chosen.start + HOUR)}`}</span><strong>{chosen.count ? `${chosen.count} ${chosen.count === 1 ? 'burst' : 'bursts'}` : 'Idle'}</strong></div>
    <p className="activity-caption">Recorded bursts. Last 24 hours, local time.{earlier ? ' Earlier readings.' : ''}</p>
  </section>;
}
